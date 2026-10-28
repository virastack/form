import React from 'react';

export const EyeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  React.createElement('svg', {
    xmlns: "http://www.w3.org/2000/svg",
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    ...props
  },
    React.createElement('path', { d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" }),
    React.createElement('circle', { cx: "12", cy: "12", r: "3" })
  )
);

export const EyeOffIcon = (props: React.SVGProps<SVGSVGElement>) => (
  React.createElement('svg', {
    xmlns: "http://www.w3.org/2000/svg",
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    ...props
  },
    React.createElement('path', { d: "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" }),
    React.createElement('path', { d: "M14.084 14.158a3 3 0 0 1-4.242-4.242" }),
    React.createElement('path', { d: "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" }),
    React.createElement('path', { d: "m2 2 20 20" })
  )
);
