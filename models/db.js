var Mongolian = require('mongolian');

module.exports = new Mongolian('mongo://localhost/rtchess');

module.exports.mk_objectid = function(id) {
    return new Mongolian.ObjectId(id);
};

