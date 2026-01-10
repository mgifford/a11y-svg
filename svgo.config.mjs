/*!
 * A11y-SVG-Studio — SVGO configuration
 * Copyright (C) 2026 A11y-SVG-Studio contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 */

export default {
  multipass: true,
  js2svg: { pretty: true, indent: 2 },
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          cleanupIds: false,
          convertUseToSymbol: false,
          removeViewBox: false,
          removeTitle: false,
          removeDesc: false
        }
      }
    },
    { name: 'removeMetadata', active: true },
    { name: 'removeEditorsNSData', active: true },
    {
      name: 'cleanupNumericValues',
      params: { floatPrecision: 3 }
    },
    {
      name: 'convertPathData',
      params: { floatPrecision: 3 }
    },
    { name: 'collapseGroups', active: false },
    { name: 'mergePaths', active: false }
  ]
};
