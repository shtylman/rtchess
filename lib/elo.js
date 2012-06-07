
function elo(win, loss) {
    var ea = 1 / (1 + Math.pow(10, (loss.rating - win.rating)/400));

    // winner score
    var score = 1;

    var k = 32;
    win.rating += Math.round(k * (score - ea));
    loss.rating += Math.round(k * ((1 - score) - (1 - ea)));
}

module.exports = elo;

