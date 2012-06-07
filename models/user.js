
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
    if (typeof id === 'string') {
        id = db.mk_objectid(id);
    }
    users.findOne({ _id: id }, cb);
};

module.exports.leaderboard = function(cb) {
    users.find().limit(100).sort({rating: -1}).toArray(cb);
};

module.exports.update = function(query, fields, cb) {
    if (typeof query._id === 'string') {
        query._id = db.mk_objectid(query._id);
    }
    users.update(query, fields, cb);
};

