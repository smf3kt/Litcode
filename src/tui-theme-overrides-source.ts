// @ts-nocheck
// Source bodies: research/ports/W44-custom-theme-copies.json.
var T={black:!0,red:!0,green:!0,yellow:!0,blue:!0,magenta:!0,cyan:!0,white:!0,blackBright:!0,redBright:!0,greenBright:!0,yellowBright:!0,blueBright:!0,magentaBright:!0,cyanBright:!0,whiteBright:!0},c=new Set(Object.keys(T));
function HK(r){if(typeof r!=="string")return!1;if(/^rgb\(\s?\d{1,3},\s?\d{1,3},\s?\d{1,3}\s?\)$/.test(r))return!0;if(/^#[0-9a-fA-F]{6}$/.test(r)||/^#[0-9a-fA-F]{3}$/.test(r))return!0;if(/^ansi256\(\d{1,3}\)$/.test(r))return!0;if(r.startsWith("ansi:"))return c.has(r.slice(5));return!1}
function i9t(r,i){if(!i)return r;let e={...r};for(let[n,o]of Object.entries(i))if(Object.hasOwn(r,n)&&HK(o))e[n]=o;return e}
export {HK,i9t};
