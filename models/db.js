var Mongolian = require('mongolian');

var conn_string = process.env.MONGODB_CONN_STRING || 'mongodb://localhost/rtchess';
module.exports = new Mongolian(conn_string);

module.exports.mk_objectid = function(id) {
    return new Mongolian.ObjectId(id);
};

