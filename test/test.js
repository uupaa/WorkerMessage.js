var ModuleTestWorkerMessage = (function(global) {

var _runOnNode = "process" in global;
var _runOnWorker = "WorkerLocation" in global;
var _runOnBrowser = "document" in global;

return new Test("WorkerMessage", {
        disable:    true,
        browser:    true,
        worker:     true,
        node:       true,
        button:     true,
        both:       true, // test the primary module and secondary module
    }).add([
    ]).run().clone();

/*
function testWorkerMessage_value(test, pass, miss) {

    var result = new WorkerMessage(123.4).value();

    if (result === 123.4) {
        test.done(pass());
    } else {
        test.done(miss());
    }
}
 */

})((this || 0).self || global);

