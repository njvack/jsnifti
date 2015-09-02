// The bulk of the magic
window.nifti1Image = require('./nifti');
// An easy way to drop these pixels on screen
window.save_pixels = require('save-pixels');

// These are all for console debugging and fun; you don't need them.
window.ndarray = require('ndarray');
window.ops = require('ndarray-ops');
window.show = require('ndarray-show');
window.imshow = require('ndarray-imshow');
