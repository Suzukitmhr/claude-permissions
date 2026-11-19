'use strict';
require('esbuild').buildSync({ entryPoints: ['src/usage-entry.js'], bundle: true,
  platform: 'node', target: 'node20', format: 'cjs', outfile: 'hooks/usage.js',
  minify: true, legalComments: 'eof' });
