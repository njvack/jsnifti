/* Currently this is just me screwing around to see what works */

var Nifti1Typeset = {
  'jBinary.all': 'Nifti1File',
  'jBinary.littleEndian': false,

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

    voxel_data: jBinary.Type({
        read: function(header) {
            var voxel_dims = header.dim.slice(1, header.dim[0] + 1);
            var vox_count = voxel_dims.reduce( function (prev, cur) { return prev * cur; });
            var bytes_per_voxel = (header.bitpix / 8);
            var byte_count = vox_count * bytes_per_voxel;
            var jdarr = new jDataView(this.view.buffer, header.vox_offset, byte_count);
            return jdarr;
        }
    }),
  }
}