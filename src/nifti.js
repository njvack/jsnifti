"use strict";
var ndarray = require('ndarray');

module.exports = function(input) {
  var my = {};
  var pub = {};
  my.input = input;

  pub.affine_method = function() {
    if (pub.header.sform_code !== 0) {
      return 'sform_affine';
    }
    if (pub.header.qform_code !== 0) {
      return 'qform_affine';
    }
    return 'fallback_affine';
  }

  pub.qform_affine = function() {
    // Stolen from XTK:
    // https://github.com/xtk/X/blob/master/io/parserNII.js
    var hdr = pub.header;

    var a = 0, b = hdr.quatern_b, c = hdr.quatern_c, d = hdr.quatern_d;
    var xd = 1.0, yd = 1.0, zd = 1.0;
    var qx = hdr.qoffset_x, qy = hdr.qoffset_y, qz = hdr.qoffset_z;
    a = 1.0 - (b*b + c*c + d*d) ;

    if( a < 0.0000001 ){                   /* special case */
      a = 1.0 / Math.sqrt(b*b+c*c+d*d) ;
      b *= a ; c *= a ; d *= a ;        /* normalize (b,c,d) vector */
      a = 0.0;                       /* a = 0 ==> 180 degree rotation */

    } else {
      a = Math.sqrt(a) ;                     /* angle = 2*arccos(a) */
    }
    // scaling factors
    if(hdr.pixdim[1] > 0.0) {
      xd = hdr.pixdim[1];
    }
    if(hdr.pixdim[2] > 0.0) {
      yd = hdr.pixdim[2];
    }
    if(hdr.pixdim[2] > 0.0) {
      zd = hdr.pixdim[3];
    }
    // qfac left handed
    if(hdr.pixdim[0] < 0.0) {
      zd = -zd;
    }

    var affine = ndarray(new Float32Array([
        (a*a+b*b-c*c-d*d)*xd, 2*(b*c-a*d)*yd, 2*(b*d+a*c)*zd, qx,
        2*(b*c+a*d)*xd, (a*a+c*c-b*b-d*d)*yd, 2*(c*d-a*b)*zd, qy,
        2*(b*d-a*c )*xd, 2*(c*d+a*b)*yd, (a*a+d*d-c*c-b*b)*zd, qz,
        0, 0, 0, 1
      ]), [4,4]);

    return affine;
  }

  pub.sform_affine = function() {
    var h = pub.header;
    var sx = h.srow_x, sy = h.srow_y, sz = h.srow_z;

    var affine = ndarray(new Float32Array([
        sx[0], sx[1], sx[2], sx[3],
        sy[0], sy[1], sy[2], sy[3],
        sz[0], sz[1], sz[2], sz[3],
        0, 0, 0, 1
      ]), [4,4]);
    return affine;
  }

  pub.fallback_affine = function() {
    // Adapted from XTK, which disagrees with nibabel; I suspect nibabel's
    // implementation is more correct.
    // https://github.com/nipy/nibabel/blob/master/nibabel/spm99analyze.py#L108
    var h = pub.header;

    var affine = ndarray(new Float32Array([
        h.pixdim[1], 0, 0, 0,
        0, h.pixdim[2], 0, 0,
        0, 0, h.pixdim[3], 0,
        0, 0, 0, 1
      ]), [4,4])
    return affine;
  }

  pub.get_affine = function() {
    var meth = pub.affine_method();
    return pub[meth]();
  }

  my.compute_stride = function(shape) {
    // For some reason, ndarray is computing stride backwards :/
    var sdup = shape.slice();
    sdup.pop(); // The last element isn't needed for computing stride
    return sdup.reduce(function(prev, cur) {
      var last = prev.pop();
      prev.push(last);
      prev.push(last * cur);
      return prev;
    }, [1])
  };

  my.data_steps = function() {
    var aff = pub.get_affine();
    var i = aff.get(0,0);
    var j = aff.get(1,1);
    var k = aff.get(2,2);
    return [
      (i > 0 ? -1 : 1),
      (j > 0 ? -1 : 1),
      (k > 0 ? -1 : 1),
    ];
  }

  pub.ras_slice = function(r, a, s) {
    return pub.voxel_data.pick(r, a, s);
  }

  pub.ras_dims = function() {
    return pub.voxel_data.shape;
  }

  my.platform_is_little_endian = function() {
    var bytes = new Int8Array([1,0])
    var shortArr = new Int16Array(bytes.buffer);
    return shortArr[0] === 1;
  };

  my.EndianTester = {
    'jBinary.all': 'EndianTest',
    'jBinary.littleEndian': true,

    EndianTest: {
      littleEndian: jBinary.Type({
        read: function(ctx) {
          var v = this.binary.view;
          if (v.getInt32(0, true) === 348) {
            return true;
          }
          if (v.getInt32(0, false) === 348) {
            return false;
          }
          throw new TypeError("Does not appear to be a nifti1 file.");
        }
      }),
    }
  }; // my.EndianTester

  my.Nifti1Typeset = {
    'jBinary.all': 'Nifti1File',
    'jBinary.littleEndian': true,

    Nifti1File: {
      sizeof_hdr: 'int32',                //   0; must be 348
      data_type: ['string0', 10],         //   4; unused
      db_name: ['string0', 18],           //  14; unused
      extents: 'int32',                   //  32; unused
      session_error: 'int16',             //  36; unused
      regular: ['string0', 1],            //  38; unused
      dim_info: 'uint8',                  //  39; MRI slice ordering code
      dim: ['array', 'int16', 8],         //  40; data array dimensions
      intent_p1: 'float32',               //  56; first intent parameter
      intent_p2: 'float32',               //  60; second intent parameter
      intent_p3: 'float32',               //  64; third intent parameter
      intent_code: 'int16',               //  68; NIFTI intent code
      datatype: 'int16',                  //  70; it's the datatype
      bitpix: 'int16',                    //  72; number of bits per voxel
      slice_start: 'int16',               //  74; first slice index
      pixdim: ['array', 'float32', 8],    //  76; grid spacings (units below)
      vox_offset: 'float32',              // 108; offset to data in image file
      scl_slope: 'float32',               // 112; data scaling slope
      scl_inter: 'float32',               // 116; data scaling intercept
      slice_end: 'int16',                 // 120; last slice index
      slice_code: 'uint8',                // 122; slice timing order
      xyzt_units: 'uint8',                // 123; units of pixdim[1..4]
      cal_max: 'float32',                 // 124; max display intensity
      cal_min: 'float32',                 // 128; min display intensity
      slice_duration: 'float32',          // 132; time for 1 slice
      toffset: 'float32',                 // 136; time axis shift
      glmax: 'int32',                     // 140; unused
      glmin: 'int32',                     // 144; unused
      descrip: ['string0', 80],           // 148; any text
      aux_file: ['string0', 24],          // 228; auxiliary filename
      qform_code: 'int16',                // 252; xform code
      sform_code: 'int16',                // 254; xform code
      quatern_b: 'float32',               // 256; quaternion b param
      quatern_c: 'float32',               // 260; quaternion c param
      quatern_d: 'float32',               // 264; quaternion d param
      qoffset_x: 'float32',               // 268; quaternion x shift
      qoffset_y: 'float32',               // 272; quaternion y shift
      qoffset_z: 'float32',               // 276; quaternion z shift
      srow_x: ['array', 'float32', 4],    // 280; 1st row affine transform
      srow_y: ['array', 'float32', 4],    // 296; 2nd row affine transform
      srow_z: ['array', 'float32', 4],    // 312; 3rd row affine transform
      intent_name: ['string', 16],        // 328; name or meaning of data
      magic: ['string0', 4],              // 344; must be 'ni1\0' or 'n+1\0'

      _binary: jBinary.Type({
        read: function(header) {
          header._binary = this;
        }
      }),

      voxel_data: jBinary.Type({
          read: function(header) {
              // The first element in dim is the number of nonzero dimensions
              var voxel_dims = header.dim.slice(1, header.dim[0] + 1);
              var vox_count = voxel_dims.reduce( function (prev, cur) { return prev * cur; });
              var bytes_per_voxel = (header.bitpix / 8);
              var byte_count = vox_count * bytes_per_voxel;
              var data_types = {
                2: [Uint8Array, 'getUint8'],
                4: [Int16Array, 'getInt16'],
                8: [Int32Array, 'getInt32'],
                16: [Float32Array, 'getFloat32'],
                64: [Float64Array, 'getFloat64'],
                256: [Int8Array, 'getInt8'],
                512: [Uint16Array, 'getUint16'],
                768: [Uint32Array, 'getUint32'],
              };
              var data_type = data_types[header.datatype][0];
              var typed_array = null;
              var _littleEndian = my.platform_is_little_endian()
              if (_littleEndian === this.view._littleEndian) {
                // We match, just make an array view
                console.log("endian match");
                var first_byte = header.vox_offset;
                var last_byte = first_byte + byte_count + 1;
                console.log("Reading from " + first_byte + " to " + last_byte)
                typed_array = new data_type(
                  this.view.buffer.slice(first_byte, last_byte));
              } else {
                // We need to copy the data.
                console.log("endian mismatch");
                var data_view = new jDataView(this.view.buffer, header.vox_offset, byte_count);
                var getter_name = data_types[header.datatype][1];
                typed_array = new data_type(vox_count);
                console.log("Allocated " + vox_count + " elements");
                for (var i = 0; i < vox_count; i++) {
                  typed_array[i] = data_view[getter_name](i * bytes_per_voxel, this.view._littleEndian);
                }
              }
              var stride = my.compute_stride(voxel_dims);
              return ndarray(typed_array, voxel_dims, stride);
          },

      }),
    }
  }; // my.Nifti1Typeset

  pub.read = function(callback) {
    jBinary.load(my.input, my.EndianTester).then(function(binary) {
      var result = binary.readAll();
      var view = binary.view;
      view._littleEndian = result.littleEndian;
      my.Nifti1Typeset['jBinary.littleEndian'] = result.littleEndian
      var nii_binary = new jBinary(binary.view, my.Nifti1Typeset);
      pub.header = nii_binary.readAll();
      var vd = pub.header.voxel_data;
      pub.voxel_data = vd.step.apply(vd, my.data_steps());
      if (typeof(callback) === 'function') {
        callback();
      }
    });
    return pub;
  }

  pub.my = my; // Remove this to make stuff private
  return pub;
};