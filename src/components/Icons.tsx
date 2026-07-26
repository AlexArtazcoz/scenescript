import { useState, useRef, useLayoutEffect } from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

/* ══════════════════════════════════════════════════════════
   MorphPath – sets CSS d property via style.setProperty
   so the transition declared in CSS actually fires.
   ══════════════════════════════════════════════════════════ */

function MorphPath({ d, ...props }: { d: string } & React.SVGProps<SVGPathElement>) {
  const ref = useRef<SVGPathElement>(null);
  useLayoutEffect(() => {
    ref.current?.style.setProperty('d', `path("${d}")`);
  }, [d]);
  return <path ref={ref} {...props} />;
}

/* ══════════════════════════════════════════════════════════
   Path data for morphing icons
   All H/V commands are normalized to L so that default
   and hover paths have identical command structures —
   required for smooth CSS d interpolation.
   ══════════════════════════════════════════════════════════ */

const DELETE_PATHS = {
  default: [
    'M7.09044 9.08305C7.04185 8.50003 7.50194 8 8.08698 8L15.9134 8C16.4984 8 16.9585 8.50003 16.9099 9.08305L16.0002 20L8.00018 20L7.09044 9.08305Z',
    'M19 7L5 7L5 5L9 5C9.55228 5 10 4.55228 10 4L10 3L14 3L14 4C14 4.55228 14.4477 5 15 5L19 5L19 7Z',
  ],
  hover: [
    'M7.61626 9.05241C7.70863 8.47471 8.27504 8.09934 8.84307 8.23937L16.442 10.1127C17.01 10.2527 17.337 10.8483 17.1503 11.4028L13.654 21.7846L5.88652 19.8698L7.61626 9.05241Z',
    'M18.5421 3.8962L4.90551 7.06547L4.45275 5.11739L8.34891 4.21188C8.88686 4.08686 9.2216 3.54942 9.09658 3.01147L8.8702 2.03743L12.7664 1.13192L12.9927 2.10596C13.1178 2.64391 13.6552 2.97865 14.1932 2.85363L18.0893 1.94812L18.5421 3.8962Z',
  ],
};

const DRAG_PATHS = {
  default: [
    'M11 20C11 20.5523 10.5523 21 10 21L7 21L7 17L10 17C10.5523 17 11 17.4477 11 18L11 20Z',
    'M17 21L14 21C13.4477 21 13 20.5523 13 20L13 18C13 17.4477 13.4477 17 14 17L17 17L17 21Z',
    'M11 13C11 13.5523 10.5523 14 10 14L7 14L7 10L10 10C10.5523 10 11 10.4477 11 11L11 13Z',
    'M17 14L14 14C13.4477 14 13 13.5523 13 13L13 11C13 10.4477 13.4477 10 14 10L17 10L17 14Z',
    'M11 6C11 6.55228 10.5523 7 10 7L7 7L7 3L10 3C10.5523 3 11 3.44772 11 4L11 6Z',
    'M17 7L14 7C13.4477 7 13 6.55228 13 6L13 4C13 3.44772 13.4477 3 14 3L17 3L17 7Z',
  ],
  hover: [
    'M10 20C10 20.5523 9.55228 21 9 21L6 21L6 17L9 17C9.55228 17 10 17.4477 10 18L10 20Z',
    'M18 21L15 21C14.4477 21 14 20.5523 14 20L14 18C14 17.4477 14.4477 17 15 17L18 17L18 21Z',
    'M10 13C10 13.5523 9.55228 14 9 14L6 14L6 10L9 10C9.55228 10 10 10.4477 10 11L10 13Z',
    'M18 14L15 14C14.4477 14 14 13.5523 14 13L14 11C14 10.4477 14.4477 10 15 10L18 10L18 14Z',
    'M10 6C10 6.55228 9.55228 7 9 7L6 7L6 3L9 3C9.55228 3 10 3.44772 10 4L10 6Z',
    'M18 7L15 7C14.4477 7 14 6.55228 14 6L14 4C14 3.44772 14.4477 3 15 3L18 3L18 7Z',
  ],
  pressed: [
    'M10 18C10 18.5523 9.55228 19 9 19L6 19L6 15L9 15C9.55228 15 10 15.4477 10 16L10 18Z',
    'M18 19L15 19C14.4477 19 14 18.5523 14 18L14 16C14 15.4477 14.4477 15 15 15L18 15L18 19Z',
    'M10 13C10 13.5523 9.55228 14 9 14L6 14L6 10L9 10C9.55228 10 10 10.4477 10 11L10 13Z',
    'M18 14L15 14C14.4477 14 14 13.5523 14 13L14 11C14 10.4477 14.4477 10 15 10L18 10L18 14Z',
    'M10 8C10 8.55228 9.55228 9 9 9L6 9L6 5L9 5C9.55228 5 10 5.44772 10 6L10 8Z',
    'M18 9L15 9C14.4477 9 14 8.55228 14 8L14 6C14 5.44772 14.4477 5 15 5L18 5L18 9Z',
  ],
};

const GENERATE_PATHS = {
  default:
    'M21.3543 4.93062C19.967 6.87749 18.8319 8.6691 18.2019 9.69396C17.9036 10.1791 18.0834 10.8089 18.5873 11.0743L23 13.3981L17.4368 15.1998C17.0988 15.3093 16.8443 15.5899 16.7681 15.9369L15.6578 21L11.9997 17.463C11.7129 17.1857 11.2887 17.1054 10.9204 17.2587L4.01405 20.1327L7.99949 12.019C8.26506 11.4783 7.99588 10.8273 7.42604 10.6321L3 9.11567L13.3183 2L13.3828 7.31958L21.3543 4.93062Z',
  hover:
    'M24 2C22.2459 4.46154 19.131 8.62896 18.0472 10.075C17.8125 10.3882 17.7825 10.808 17.9691 11.1519L22.5 19.5L17.9398 16.1476C17.4104 15.7584 16.656 15.9768 16.4164 16.5887L13.3183 24.5L11.7458 17.921C11.623 17.407 11.1213 17.0773 10.6007 17.1685L3 18.5L8.01738 11.6581C8.29829 11.2751 8.27096 10.7472 7.95199 10.3953L3 4.93062L13.3183 2L13.3828 7.31958L24 2Z',
};

const UNLOCKED_PATHS = {
  default:
    'M12 1.5C15.0376 1.5 17.5 3.96243 17.5 7L17.5 9C17.5 9.55228 17.9477 10 18.5 10L20 10L20 21L4 21L4 10L13.5 10C14.0523 10 14.5 9.55228 14.5 9L14.5 7C14.5 5.61929 13.3807 4.5 12 4.5C10.6193 4.5 9.5 5.61929 9.5 7L9.5 7.5L6.5 7.5L6.5 7C6.5 3.96243 8.96243 1.5 12 1.5Z',
  hover:
    'M12 1.5C15.0376 1.5 17.5 3.96243 17.5 7L17.5 9C17.5 9.55228 17.9477 10 18.5 10L20 10L20 21L4 21L4 10L13.5 10C14.0523 10 14.5 9.55228 14.5 9L14.5 7C14.5 5.61929 13.3807 4.5 12 4.5C10.6193 4.5 9.5 5.61929 9.5 7L9.5 10.5L6.5 10.5L6.5 7C6.5 3.96243 8.96243 1.5 12 1.5Z',
};

/* ══════════════════════════════════════════════════════════
   Morphing icon components
   ══════════════════════════════════════════════════════════ */

export function DeleteIcon({ size = 24, className }: IconProps) {
  const [hovered, setHovered] = useState(false);
  const paths = hovered ? DELETE_PATHS.hover : DELETE_PATHS.default;

  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      className={`morphing-icon ${className || ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <MorphPath d={paths[0]} fill="currentColor" />
      <MorphPath d={paths[1]} fill="currentColor" />
    </svg>
  );
}

export function DragIcon({ size = 24, className, isPressed: externalPressed }: IconProps & { isPressed?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const [internalPressed, setInternalPressed] = useState(false);
  const pressed = externalPressed ?? internalPressed;
  const paths = pressed
    ? DRAG_PATHS.pressed
    : hovered
      ? DRAG_PATHS.hover
      : DRAG_PATHS.default;

  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      className={`morphing-icon ${className || ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setInternalPressed(false); }}
      onMouseDown={() => setInternalPressed(true)}
      onMouseUp={() => setInternalPressed(false)}
    >
      {paths.map((d, i) => (
        <MorphPath key={i} d={d} fill="currentColor" />
      ))}
    </svg>
  );
}

export function GenerateIcon({ size = 24, className }: IconProps) {
  const [hovered, setHovered] = useState(false);
  const d = hovered ? GENERATE_PATHS.hover : GENERATE_PATHS.default;

  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      className={`morphing-icon ${className || ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <MorphPath d={d} fill="currentColor" />
    </svg>
  );
}

export function UnlockedIcon({ size = 24, className }: IconProps) {
  const [hovered, setHovered] = useState(false);
  const d = hovered ? UNLOCKED_PATHS.hover : UNLOCKED_PATHS.default;

  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      className={`morphing-icon ${className || ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <MorphPath d={d} fill="currentColor" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════
   PenIcon — 28×48, morphs between bent and straight pen
   ══════════════════════════════════════════════════════════ */

/* All stroke paths: [0] outer shape, [1] cross line, [2] inner left, [3] inner right, [4] nib tip */
const PEN_PATHS = {
  bend: [
    'M11 40.9999L21 45.4999L21.8048 34.4999C21.8048 34.4999 17.5 26.4999 17.5 24.9999C17.5 23.4999 21.8048 16.4073 21.8048 16.4073C21.8048 16.4073 25.6966 10.5178 23.7772 7.76956C21.8578 5.02132 17.5304 2.55162 15 3.99984C12.4696 5.44806 10.0264 9.81045 10.0264 9.81045C10.0264 9.81045 4.00001 21.4999 4 24.9999C3.99999 28.4999 11 40.9999 11 40.9999Z',
    'M10 11L21 17',
    'M13 36C13 36 8.5 27 8.5 25C8.5 23 13.5 13.5 13.5 13.5',
    'M17 33.5C17 33.5 13 26 13 25C13 24 17.5 15.5 17.5 15.5',
    'M16.998 42.998L20.5 40.4999L20.5 43.9999L19 42.9999',
  ],
  straight: [
    'M5.93579 37L12.5 46L19.4282 37C19.4282 37 19.4282 28.5 19.4282 28.5C19.4282 28.5 19.4282 12.6735 19.4282 12.6735C19.4282 12.6735 19.718 5.62017 16.6548 4.25861C13.5916 2.89706 8.61054 3.01795 7.19211 5.56513C5.77368 8.11231 5.93525 13.1097 5.93525 13.1097C5.93525 13.1097 5.9358 21.4997 5.93579 24.9997C5.93579 24.9997 5.93579 37 5.93579 37Z',
    'M6.85352 12.3848L19.3835 12.3686',
    'M10.8856 34.0003C10.8856 34.0003 10.8859 26.3738 10.8857 24.5003C10.8855 22.6268 10.8857 12.8982 10.8857 12.8982',
    'M14.9553 33.9998C14.9553 33.9998 14.955 24.9998 14.955 22.7878C14.955 20.5757 14.955 12.7323 14.955 12.7323',
    'M11 42L15.3005 42.1026L13.2005 44.9026L12.6005 43.2026',
  ],
};

export function PenIcon({ className, forceHovered, scale, noHover }: { className?: string; forceHovered?: boolean; scale?: number; noHover?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const isHovered = !noHover && (forceHovered || hovered);
  const paths = isHovered ? PEN_PATHS.straight : PEN_PATHS.bend;
  const w = 28 * (scale ?? 1);
  const h = 48 * (scale ?? 1);

  return (
    <svg
      width={w} height={h} viewBox="0 0 28 48" fill="none"
      className={`morphing-icon cursor-pointer ${className || ''}`}
      onMouseEnter={() => !noHover && setHovered(true)}
      onMouseLeave={() => !noHover && setHovered(false)}
    >
      {paths.map((d, i) => (
        <MorphPath
          key={i}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════
   Static icons (no morphing states)
   ══════════════════════════════════════════════════════════ */

export function EditIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M15.8896 4.36829L20.1322 8.61093L12.6469 16.0962C11.8659 16.8773 10.5996 16.8773 9.81851 16.0962L8.40429 14.682C7.62324 13.9009 7.62324 12.6346 8.40429 11.8536L15.8896 4.36829Z" fill="currentColor"/>
      <path d="M4.5 20L8.54158 18.9499C9.2899 18.7554 9.5439 17.8216 8.99719 17.2749L7.22547 15.5032C6.67879 14.9565 5.74504 15.2104 5.55053 15.9587L4.5 20Z" fill="currentColor"/>
    </svg>
  );
}

export function ApiKeyIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path fillRule="evenodd" clipRule="evenodd" d="M19.5721 5.13562C19.9627 5.52616 19.9627 6.15936 19.5721 6.54988L13.9152 12.206C13.5246 12.5965 13.5246 13.2297 13.9152 13.6202L15.3301 15.0352L9.67293 20.6923C9.2824 21.0828 8.64924 21.0828 8.25871 20.6923L3.30872 15.7423C2.91818 15.3518 2.9182 14.7186 3.30878 14.328L8.96582 8.67188L10.3801 10.0855C10.7705 10.4757 11.4034 10.4758 11.7939 10.0855L12.501 9.37891L11.0869 7.96484L12.501 6.5498L13.2072 7.25652C13.5976 7.64718 14.2308 7.64739 14.6214 7.257L15.3291 6.5498L13.915 5.13574L15.3291 3.72168L16.0363 4.42888C16.4267 4.81931 17.0597 4.81942 17.4503 4.42912L18.1582 3.72168L19.5721 5.13562ZM6.84375 15.0352L8.96484 17.1572L10.3792 15.7423C10.7695 15.3517 10.7695 14.7187 10.379 14.3282L9.67195 13.6212C9.28143 13.2306 8.64826 13.2306 8.25774 13.6212L6.84375 15.0352Z" fill="currentColor"/>
    </svg>
  );
}

export function CloseIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M19.3779 6.77209L14.8428 11.3072C14.4523 11.6977 14.4523 12.3309 14.8428 12.7214L19.3779 17.2565L17.2568 19.3785L12.7208 14.8425C12.3303 14.452 11.6971 14.452 11.3066 14.8426L6.77148 19.3785L4.65039 17.2574L9.18567 12.7213C9.57611 12.3308 9.57611 11.6978 9.18567 11.3072L4.65039 6.77112L6.77148 4.65002L11.3066 9.18517C11.6971 9.57567 12.3302 9.5757 12.7208 9.18524L17.2568 4.65002L19.3779 6.77209Z" fill="currentColor"/>
    </svg>
  );
}

export function MenuIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M21 21H3V18C3 17.4477 3.44772 17 4 17H20C20.5523 17 21 17.4477 21 18V21Z" fill="currentColor"/>
      <path d="M21 13C21 13.5523 20.5523 14 20 14H4C3.44772 14 3 13.5523 3 13V11C3 10.4477 3.44772 10 4 10H20C20.5523 10 21 10.4477 21 11V13Z" fill="currentColor"/>
      <path d="M21 6C21 6.55228 20.5523 7 20 7H4C3.44772 7 3 6.55228 3 6V3H21V6Z" fill="currentColor"/>
    </svg>
  );
}

export function LockedIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 1.5C15.0376 1.5 17.5 3.96243 17.5 7L17.5 9C17.5 9.55228 17.9477 10 18.5 10L20 10L20 21L4 21L4 10L5.5 10C6.05228 10 6.5 9.55228 6.5 9L6.5 7C6.5 3.96243 8.96243 1.5 12 1.5ZM12 4.5C10.6193 4.5 9.5 5.61929 9.5 7L9.5 9C9.5 9.55228 9.94772 10 10.5 10L13.5 10C14.0523 10 14.5 9.55228 14.5 9L14.5 7C14.5 5.61929 13.3807 4.5 12 4.5Z" fill="currentColor"/>
    </svg>
  );
}

export function ConfigIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path fillRule="evenodd" clipRule="evenodd" d="M13.8699 6.66895C14.1095 6.74786 14.3422 6.84098 14.5666 6.94826L17.6562 4.92871L19.0703 6.34277L17.2102 9.51155C17.321 9.72915 17.418 9.95437 17.4995 10.1867L21 11V13L17.4995 13.8123C17.418 14.0447 17.321 14.2698 17.2102 14.4875L19.0703 17.6572L17.6562 19.0713L14.5666 17.0508C14.3421 17.1581 14.1095 17.2511 13.8699 17.3301L13 21H11L10.1291 17.3301C9.88904 17.2509 9.65613 17.1573 9.43133 17.0497L6.34277 19.0713L4.92871 17.6572L6.7877 14.4875C6.67701 14.27 6.58093 14.0445 6.49951 13.8123L3 13V11L6.49951 10.1867C6.58097 9.95456 6.67698 9.72898 6.7877 9.51155L4.92871 6.34277L6.34277 4.92871L9.43133 6.94936C9.6561 6.84177 9.88907 6.74805 10.1291 6.66895L11 3H13L13.8699 6.66895ZM12 10C10.8954 10 10 10.8954 10 12C10 13.1046 10.8954 14 12 14C13.1046 14 14 13.1046 14 12C14 10.8954 13.1046 10 12 10Z" fill="currentColor"/>
    </svg>
  );
}

/* 50×50 config gear (from config_50.svg) */
export function Config50Icon({ className }: { className?: string }) {
  return (
    <svg width="50" height="50" viewBox="0 0 50 50" fill="none" className={className}>
      <path fillRule="evenodd" clipRule="evenodd" d="M28.8956 13.8936C29.3948 14.058 29.8795 14.252 30.347 14.4755L36.7839 10.2681L39.7298 13.2141L35.8546 19.8157C36.0855 20.2691 36.2874 20.7383 36.4573 21.2224L43.75 22.9167V27.0833L36.4573 28.7756C36.2875 29.2598 36.0854 29.7288 35.8546 30.1822L39.7298 36.7859L36.7839 39.7319L30.347 35.5224C29.8795 35.746 29.3949 35.9399 28.8956 36.1043L27.0833 43.75H22.9167L21.1023 36.1043C20.6022 35.9395 20.1169 35.7444 19.6486 35.5201L13.2141 39.7319L10.2681 36.7859L14.141 30.1822C13.9104 29.7292 13.7103 29.2594 13.5406 28.7756L6.25 27.0833V22.9167L13.5406 21.2224C13.7104 20.7387 13.9104 20.2687 14.141 19.8157L10.2681 13.2141L13.2141 10.2681L19.6486 14.4778C20.1169 14.2537 20.6022 14.0584 21.1023 13.8936L22.9167 6.25H27.0833L28.8956 13.8936ZM25 20.8333C22.6988 20.8333 20.8333 22.6988 20.8333 25C20.8333 27.3012 22.6988 29.1667 25 29.1667C27.3012 29.1667 29.1667 27.3012 29.1667 25C29.1667 22.6988 27.3012 20.8333 25 20.8333Z" fill="currentColor"/>
    </svg>
  );
}

/* Menu action icons (import, export, youtube description) */
export function ImportMenuIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 19C4 17.8954 4.89543 17 6 17H18C19.1046 17 20 17.8954 20 19V21H4V19Z" fill="currentColor"/>
      <path d="M4 8L6 5.5L8.3415 7.54881C8.98808 8.11457 10 7.65539 10 6.79623L10 3L14 3L14 6.79623C14 7.65539 15.0119 8.11457 15.6585 7.54881L18 5.5L20 8L12.6585 14.4238C12.2815 14.7537 11.7185 14.7537 11.3415 14.4238L4 8Z" fill="currentColor"/>
    </svg>
  );
}

export function ExportMenuIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 18C4 17.4477 4.44772 17 5 17H19C19.5523 17 20 17.4477 20 18V21H4V18Z" fill="currentColor"/>
      <path d="M20 10L18 12.5L15.6585 10.4512C15.0119 9.88543 14 10.3446 14 11.2038V15H10V11.2038C10 10.3446 8.98808 9.88543 8.3415 10.4512L6 12.5L4 10L11.3415 3.57619C11.7185 3.24629 12.2815 3.24629 12.6585 3.57619L20 10Z" fill="currentColor"/>
    </svg>
  );
}

export function YouTubeDescIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 4H20V7C20 7.55228 19.5523 8 19 8H4V4Z" fill="currentColor"/>
      <path d="M4 10H20V13C20 13.5523 19.5523 14 19 14H4V10Z" fill="currentColor"/>
      <path d="M4 16H16V19C16 19.5523 15.5523 20 15 20H4V16Z" fill="currentColor"/>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════
   InfoIcon — morphs between info_01 (dot in circle) and
   info_02 (pill extending right from circle).
   Both inner shapes are written as M L A L A L A L A Z so
   the CSS d-property transition has identical command counts.

   State logic (XOR):
     default (not active, not hovered) → dot,    black
     hover   (not active)              → pill,   accent
     active  (pressed, not hovered)   → pill,   accent
     active + hover                   → dot,    black
   ══════════════════════════════════════════════════════════ */

const INFO_PATHS = {
  // Small circle centered at (12,12) as rounded-rect path (rx=ry=3, w=h=6)
  default: 'M 12 9 L 12 9 A 3 3 0 0 1 15 12 L 15 12 A 3 3 0 0 1 12 15 L 12 15 A 3 3 0 0 1 9 12 L 9 12 A 3 3 0 0 1 12 9 Z',
  // Pill extending right (rect x=9 y=10 w=16 h=4 rx=2, right edge at x=25)
  active:  'M 11 10 L 23 10 A 2 2 0 0 1 25 12 L 25 12 A 2 2 0 0 1 23 14 L 11 14 A 2 2 0 0 1 9 12 L 9 12 A 2 2 0 0 1 11 10 Z',
};

export function InfoIcon({
  size = 24,
  className,
  isActive,
  onToggle,
}: IconProps & { isActive?: boolean; onToggle?: () => void }) {
  const [hovered, setHovered] = useState(false);
  // OR: pressed stays pressed on hover; only un-pressed state reacts to hover
  const useActiveState = (isActive ?? false) || hovered;
  const color = useActiveState ? 'var(--color-accent)' : 'currentColor';
  const d = useActiveState ? INFO_PATHS.active : INFO_PATHS.default;

  return (
    <svg
      width={size} height={size} viewBox="0 0 25 24" fill="none"
      className={`morphing-icon cursor-pointer ${className || ''}`}
      style={{ color }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onToggle}
    >
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="3" />
      <MorphPath d={d} fill="currentColor" />
    </svg>
  );
}

export function NewSceneIcon({ size = 50, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 50 50" fill="none" className={className}>
      <path d="M27 21C27 22.1046 27.8954 23 29 23H44V27H29C27.8954 27 27 27.8954 27 29V44H23V29C23 27.8954 22.1046 27 21 27H6V23H21C22.1046 23 23 22.1046 23 21V6H27V21Z" fill="currentColor"/>
    </svg>
  );
}
