import { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DeleteIcon, DragIcon, EditIcon, NewSceneIcon, Config50Icon } from '../Icons';
import { useScriptStore } from '../../stores/scriptStore';
import { useUIStore } from '../../stores/uiStore';
import type { Script, ScriptStatus } from '../../types';

const STATUS_ORDER: ScriptStatus[] = ['backlog', 'in-progress', 'done'];
const STATUS_LABELS: Record<ScriptStatus, string> = {
  'backlog': 'Backlog',
  'in-progress': 'In Progress',
  'done': 'Done',
};

/* ── Script Settings Modal ── */
function ScriptSettingsModal({
  mode,
  script,
  onClose,
  onSave,
}: {
  mode: 'create' | 'edit';
  script?: Script;
  onClose: () => void;
  onSave: (name: string, titleJP: string) => void;
}) {
  const [name, setName] = useState(script?.name ?? '');
  const [titleJP, setTitleJP] = useState(script?.titleJP ?? '');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Close on Escape, block outside close via overlay click
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = () => {
    if (name.trim()) onSave(name.trim(), titleJP.trim());
  };

  const isDisabled = !name.trim();

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/40" />
      {/* Centered within the 400px script panel */}
      <div
        style={{
          position: 'fixed',
          left: 235, top: '50%',
          width: 314,
          borderRadius: 16,
          border: '0.5px solid #E6E6E6',
          background: 'white',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          animation: 'ref-dialog-in 0.25s cubic-bezier(0.2, 0, 0, 1) both',
        }}
        onClick={e => e.stopPropagation()}
      >
          <div style={{ height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-headline)', fontSize: 18, textTransform: 'uppercase' }}>
              {mode === 'create' ? 'New Script' : 'Edit Script'}
            </span>
          </div>

          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder="English title"
            style={{
              height: 40, borderRadius: 8, border: '0.5px solid #E6E6E6',
              paddingLeft: 10, fontSize: 13, outline: 'none', flexShrink: 0,
              margin: 0, background: 'transparent', fontWeight: 500,
            }}
          />

          <input
            type="text"
            value={titleJP}
            onChange={e => setTitleJP(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder="日本語タイトル"
            style={{
              height: 40, borderRadius: 8, border: '0.5px solid #E6E6E6',
              paddingLeft: 10, fontSize: 13, outline: 'none', flexShrink: 0,
              margin: 0, background: 'transparent', fontWeight: 500,
            }}
          />

          <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, height: 40, borderRadius: 8,
                border: '0.5px solid #E6E6E6', background: 'transparent',
                cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#7C7C7C',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isDisabled}
              style={{
                flex: 1, height: 40, borderRadius: 8,
                background: isDisabled ? '#E6E6E6' : 'var(--color-accent)',
                color: 'white',
                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              }}
            >
              {mode === 'create' ? 'Create' : 'Save'}
            </button>
          </div>
      </div>
    </div>
  );
}

/* ── Single sortable script row ── */
function SortableScriptItem({
  script,
  isActive: _isActive,
  confirmingDeleteId,
  onSelect,
  onEdit,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  script: Script;
  isActive: boolean;
  confirmingDeleteId: string | null;
  onSelect: (id: string) => void;
  onEdit: (script: Script) => void;
  onRequestDelete: (id: string) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: script.id });

  const [hovered, setHovered] = useState(false);
  const isConfirming = confirmingDeleteId === script.id;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {isConfirming ? (
        <div className="flex items-center gap-2 py-[8px] min-h-[40px]">
          <span
            className="flex-1 min-w-0 truncate text-red-400 text-[13px]"
            style={{ fontFamily: 'var(--font-headline)' }}
          >
            Delete?
          </span>
          <button
            onClick={() => onConfirmDelete(script.id)}
            className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[11px] rounded-md transition-colors"
          >
            Delete
          </button>
          <button
            onClick={onCancelDelete}
            className="px-2.5 py-1 bg-white/10 hover:bg-white/15 text-white/50 text-[11px] rounded-md transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div
          className="group flex items-center py-[8px] min-h-[40px] cursor-pointer relative"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={() => onSelect(script.id)}
        >
          {/* Active indicator dot — positioned absolutely so it doesn't shift layout */}
          <div
            style={{
              position: 'absolute',
              left: -12,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: 'var(--color-accent)',
              opacity: _isActive ? 1 : 0,
              transition: 'opacity 0.15s ease',
            }}
          />
          {/* Script name */}
          <span
            className="flex-1 min-w-0 truncate text-[26px] leading-[1.05] uppercase transition-colors"
            style={{
              fontFamily: 'var(--font-headline)',
              color: (_isActive || hovered) ? 'var(--color-accent)' : 'white',
            }}
          >
            {script.name}
          </span>

          {/* Hover icons: delete / edit / drag */}
          <div
            className="flex items-center gap-1 flex-shrink-0"
            style={{
              opacity: hovered ? 1 : 0,
              transition: 'opacity 0.15s ease',
              pointerEvents: hovered ? 'auto' : 'none',
            }}
          >
            <button
              onClick={e => { e.stopPropagation(); onRequestDelete(script.id); }}
              onPointerDown={e => e.stopPropagation()}
              className="p-0.5 text-white/30 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <DeleteIcon size={24} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onEdit(script); }}
              onPointerDown={e => e.stopPropagation()}
              className="p-0.5 text-white/30 hover:text-white transition-colors"
              title="Edit"
            >
              <EditIcon size={24} />
            </button>
            <button
              {...listeners}
              {...attributes}
              onPointerDown={e => { e.stopPropagation(); (listeners as { onPointerDown?: (e: React.PointerEvent) => void })?.onPointerDown?.(e); }}
              className="p-0.5 text-white/30 hover:text-white transition-colors cursor-grab active:cursor-grabbing"
              title="Reorder"
            >
              <DragIcon size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Droppable category section ── */
function CategorySection({
  status,
  activeDragId,
  children,
}: {
  status: ScriptStatus;
  activeDragId: string | null;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="mb-6">
      <div className="subheading mb-3">{STATUS_LABELS[status]}</div>
      <div
        ref={setNodeRef}
        className={`min-h-[8px] rounded transition-colors duration-150 ${
          isOver && activeDragId ? 'bg-white/5' : ''
        }`}
      >
        {children}
      </div>
    </div>
  );
}

/* ── Main Sidebar ── */
export function Sidebar() {
  const {
    scripts,
    activeScriptId,
    createScript,
    deleteScript,
    updateScript,
    setActiveScript,
  } = useScriptStore();

  const { sidebarOpen, sidebarClosing, setSidebarOpen, setPendingScriptSwitch, addToast, setSettingsModalOpen } = useUIStore();

  // Modal: null = closed, 'create' = new script, Script = edit existing
  const [modalTarget, setModalTarget] = useState<null | 'create' | Script>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Group scripts by status
  const grouped: Record<ScriptStatus, Script[]> = {
    'backlog': [],
    'in-progress': [],
    'done': [],
  };
  for (const s of scripts) {
    grouped[s.status ?? 'backlog'].push(s);
  }

  const handleSelect = (id: string) => {
    if (id === activeScriptId) {
      setSidebarOpen(false);
      return;
    }
    setSidebarOpen(false);
    setPendingScriptSwitch(id);
  };

  const handleModalSave = async (name: string, titleJP: string) => {
    if (modalTarget === 'create') {
      const script = await createScript(name);
      await updateScript(script.id, { titleJP });
      setModalTarget(null);
      await setActiveScript(script.id);
      setSidebarOpen(false);
      addToast({ type: 'success', message: `Created "${name}"` });
    } else if (modalTarget && typeof modalTarget === 'object') {
      await updateScript(modalTarget.id, { name, titleJP });
      setModalTarget(null);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over) return;

    const scriptId = active.id as string;
    const overId = over.id as string;

    // Determine target status: either dropped on a category zone or another script
    let targetStatus: ScriptStatus | null = null;
    if (STATUS_ORDER.includes(overId as ScriptStatus)) {
      targetStatus = overId as ScriptStatus;
    } else {
      for (const status of STATUS_ORDER) {
        if (grouped[status].some(s => s.id === overId)) {
          targetStatus = status;
          break;
        }
      }
    }
    if (!targetStatus) return;

    const script = scripts.find(s => s.id === scriptId);
    if (!script) return;
    const currentStatus: ScriptStatus = script.status ?? 'backlog';
    if (currentStatus !== targetStatus) {
      await updateScript(scriptId, { status: targetStatus });
    }
  };

  const draggedScript = activeDragId ? scripts.find(s => s.id === activeDragId) : null;

  return (
    <>
      <div className={`scripts-sidebar ${sidebarOpen ? 'is-open' : ''} ${sidebarClosing ? 'is-closing' : ''}`}>
        <div className="flex flex-col h-full relative">

          {/* Scrollable script list — starts 94px from top */}
          <div
            className="flex-1 overflow-y-auto"
            style={{ paddingTop: '94px', paddingLeft: '24px', paddingRight: '24px', paddingBottom: '160px' }}
          >
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {STATUS_ORDER.map(status => {
                const group = grouped[status];
                return (
                  <CategorySection key={status} status={status} activeDragId={activeDragId}>
                    <SortableContext
                      items={group.map(s => s.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {group.length === 0 ? (
                        <div className="text-white/15 text-[11px] py-1">—</div>
                      ) : (
                        group.map(script => (
                          <SortableScriptItem
                            key={script.id}
                            script={script}
                            isActive={script.id === activeScriptId}
                            confirmingDeleteId={confirmingDeleteId}
                            onSelect={handleSelect}
                            onEdit={s => setModalTarget(s)}
                            onRequestDelete={id => setConfirmingDeleteId(id)}
                            onConfirmDelete={async id => {
                              const s = scripts.find(s => s.id === id);
                              await deleteScript(id);
                              setConfirmingDeleteId(null);
                              addToast({ type: 'success', message: `Deleted "${s?.name ?? 'Script'}"` });
                            }}
                            onCancelDelete={() => setConfirmingDeleteId(null)}
                          />
                        ))
                      )}
                    </SortableContext>
                  </CategorySection>
                );
              })}

              <DragOverlay>
                {draggedScript ? (
                  <div className="py-[8px]">
                    <span
                      className="text-[26px] leading-[1.05] uppercase text-[var(--color-accent)]"
                      style={{ fontFamily: 'var(--font-headline)' }}
                    >
                      {draggedScript.name}
                    </span>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>

          {/* Icons — absolute, always 24px from bottom */}
          <div style={{ position: 'absolute', bottom: 24, left: 24, display: 'flex', gap: 16, zIndex: 1 }}>
            <button
              onClick={() => setModalTarget('create')}
              className="sidebar-icon-btn sidebar-icon-plus"
              title="New script"
            >
              <NewSceneIcon size={50} />
            </button>
            <button
              onClick={() => setSettingsModalOpen(true)}
              className="sidebar-icon-btn sidebar-icon-settings"
              title="Settings"
            >
              <Config50Icon />
            </button>
          </div>

        </div>
      </div>

      {/* Script settings modal — rendered outside scripts-sidebar to avoid clipping */}
      {modalTarget !== null && (
        <ScriptSettingsModal
          mode={modalTarget === 'create' ? 'create' : 'edit'}
          script={typeof modalTarget === 'object' ? modalTarget : undefined}
          onClose={() => setModalTarget(null)}
          onSave={handleModalSave}
        />
      )}
    </>
  );
}
