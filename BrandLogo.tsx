import React from 'react';

interface BrandLogoProps {
  variant?: 'mark' | 'horizontal' | 'stacked';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  xs: { mark: 'w-7 h-7', text: 'text-sm', stackedText: 'text-xs' },
  sm: { mark: 'w-9 h-9', text: 'text-[15px]', stackedText: 'text-sm' },
  md: { mark: 'w-10 h-10', text: 'text-[17px]', stackedText: 'text-base' },
  lg: { mark: 'w-14 h-14', text: 'text-xl', stackedText: 'text-lg' },
} as const;

export function FieldShiftMark({
  className = 'w-9 h-9',
}: {
  className?: string;
}) {
  const uid = React.useId().replace(/:/g, '');
  const upperId = `fs-upper-${uid}`;
  const circleId = `fs-circle-${uid}`;
  const lowerId = `fs-lower-${uid}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 190"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={upperId}>
          <path d="M 30 30 H 175 V 80 C 145 96, 98 112, 34 114 Z" />
        </clipPath>
        <clipPath id={circleId}>
          <circle cx="100" cy="105" r="61" />
        </clipPath>
        <clipPath id={lowerId}>
          <path d="M 32 124 C 86 118, 134 102, 168 82 L 172 174 H 32 Z" />
        </clipPath>
      </defs>

      {/* Top-left azure orbital arc */}
      <path
        d="M 27 89 C 24 62, 46 33, 83 25 C 102 21, 120 22, 133 27 C 117 26, 98 28, 79 34 C 52 43, 35 65, 27 89 Z"
        fill="#0D67C2"
      />

      {/* Gold 4-point star */}
      <path
        d="M 146 14 C 147.8 27.5, 151 30.8, 164 32.5 C 151 34.2, 147.8 37.5, 146 51 C 144.2 37.5, 141 34.2, 128 32.5 C 141 30.8, 144.2 27.5, 146 14 Z"
        fill="#C78D18"
      />

      {/* Upper Earth hemisphere */}
      <g clipPath={`url(#${circleId})`}>
        <g clipPath={`url(#${upperId})`}>
          <circle cx="100" cy="105" r="61" fill="#5BB5F0" />

          {/* North & Central America */}
          <path
            d="M 42 62 C 48 54, 62 47, 74 47 C 81 47, 87 49, 90 54 C 86 58, 80 57, 77 61 C 74 65, 81 66, 85 69 C 89 72, 91 78, 86 81 C 82 84, 78 80, 74 82 C 70 84, 72 89, 77 92 C 81 94, 83 98, 80 101 C 74 103, 66 99, 61 93 C 56 87, 57 79, 52 75 C 47 72, 41 75, 38 78 Z"
            fill="#062B61"
          />

          {/* Greenland & northern islands */}
          <path
            d="M 92 43 C 99 42, 108 44, 111 49 C 113 53, 107 58, 102 58 C 97 58, 94 53, 92 48 Z"
            fill="#062B61"
          />
          <path
            d="M 113 48 C 117 47, 121 49, 121 53 C 120 56, 115 56, 113 53 Z"
            fill="#062B61"
          />

          {/* Europe & Africa */}
          <path
            d="M 129 48 C 141 51, 152 60, 159 73 C 154 78, 149 85, 147 93 C 142 96, 136 93, 134 88 C 132 83, 138 79, 135 74 C 132 70, 125 71, 123 67 C 121 63, 128 60, 126 55 C 125 52, 126 49, 129 48 Z"
            fill="#062B61"
          />

          {/* Eastern South America sliver */}
          <path
            d="M 155 83 C 160 85, 163 90, 162 97 L 151 99 C 150 93, 152 87, 155 83 Z"
            fill="#062B61"
          />
        </g>
      </g>

      {/* Lower Curved Agricultural Fields */}
      <g clipPath={`url(#${circleId})`}>
        <g clipPath={`url(#${lowerId})`}>
          <circle cx="100" cy="105" r="61" fill="#FFFFFF" />

          {/* Top curved navy terrace */}
          <path
            d="M 34 128 C 72 121, 112 111, 151 93 L 155 98 C 117 118, 76 129, 36 136 Z"
            fill="#062B61"
          />

          {/* Split navy terraces on left */}
          <path
            d="M 38 140 C 66 135, 96 127, 126 113 L 106 129 C 84 137, 62 142, 42 146 Z"
            fill="#062B61"
          />
          <path
            d="M 46 151 C 62 148, 79 144, 96 138 L 76 156 C 64 159, 55 157, 46 151 Z"
            fill="#062B61"
          />

          {/* Central sweeping bright blue field band */}
          <path
            d="M 60 162 C 88 142, 122 120, 162 103 L 164 114 C 128 128, 101 146, 81 167 Z"
            fill="#0D67C2"
          />

          {/* Deep green rows on right */}
          <path
            d="M 88 168 C 109 147, 134 129, 165 119 L 165 133 C 141 141, 122 155, 108 170 Z"
            fill="#0A4A3E"
          />
          <path
            d="M 116 170 C 130 156, 146 144, 164 139 L 160 168 Z"
            fill="#0A4A3E"
          />
        </g>
      </g>

      {/* Orbital Sweep Ribbon */}
      <path
        d="M 36 105 C 21 112, 23 118, 43 116 C 84 111, 134 91, 174 52 L 177 54 C 138 98, 86 124, 41 128 C 12 130, 8 113, 36 105 Z"
        fill="#062B61"
      />

      {/* Arrowhead */}
      <path
        d="M 192 27 L 157 47 L 169 51 L 176 64 Z"
        fill="#062B61"
      />
      <path
        d="M 190 29 L 168 51 L 175 58 Z"
        fill="#0D67C2"
      />
    </svg>
  );
}

export function BrandLogo({
  variant = 'horizontal',
  size = 'sm',
  className = '',
}: BrandLogoProps) {
  const s = SIZE_MAP[size];

  if (variant === 'mark') {
    return (
      <span className={`inline-flex items-center justify-center shrink-0 ${className}`}>
        <FieldShiftMark className={s.mark} />
      </span>
    );
  }

  if (variant === 'stacked') {
    return (
      <span className={`inline-flex flex-col items-center gap-1.5 shrink-0 ${className}`}>
        <FieldShiftMark className={s.mark} />
        <span
          dir="ltr"
          className={`font-black tracking-[0.06em] uppercase text-[#062B61] leading-none whitespace-nowrap ${s.stackedText}`}
        >
          FIELD SHIFT
        </span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 shrink-0 ${className}`}>
      <FieldShiftMark className={s.mark} />
      <span
        dir="ltr"
        className={`font-black tracking-[0.04em] uppercase text-[#062B61] leading-none whitespace-nowrap ${s.text}`}
      >
        FIELD SHIFT
      </span>
    </span>
  );
}
