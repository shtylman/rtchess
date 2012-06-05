var EventEmitter = require('events').EventEmitter;

var LETTERS = 'abcdefgh';
var L2N = {};
(function() {
    for(var i=0, l = LETTERS.length; i < l; ++i) {
        L2N[LETTERS[i]] = i;
    }
})();

var COLORS = {
    b: 'Black',
    w: 'White'
};

function letter2color(letter) {
    return COLORS[letter[0]];
}

function bindPassThrough(events, to, from) {
    function bind(ev) {
        from.on(ev, function() {
            var args = Array.prototype.slice.call(arguments, 0);
            args.splice(0, 0, ev);
            to.emit.apply(to, args);
        });
    }

    for(var i=0, l=events.length; i < l; ++i) {
        bind(events[i]);
    }
}

module.exports = {
    locString: function(nloc) {
        return LETTERS[nloc[0]-1] + nloc[1];
    },
    l2n: function(l) {
        return L2N[l];
    },
    bindPassThrough: bindPassThrough,
    letter2color: letter2color,
    LETTERS: LETTERS
};
