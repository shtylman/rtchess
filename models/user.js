
var db = require('./db');

var users = db.collection('users');

module.exports.find_or_create = function(query, cb) {
    users.findOne({ email: query.email }, function(err, user) {
        if (err) {
            return cb(err);
        }

        if (user) {
            return cb(null, user);
        }

        // new user
        users.insert(query, function(err, user) {
            if (err) {
                return cb(err);
            }

            return cb(null, user);
        });
    });
};

module.exports.find_by_id = function(id, cb) {
    users.findOne({ _id: db.mk_objectid(id) }, cb);
};

