var ModuleTestWorkerMessage = (function(global) {

var _runOnNode = "process" in global;
var _runOnWorker = "WorkerLocation" in global;
var _runOnBrowser = "document" in global;

var EXIT_CODE = WorkerMessage.EXIT_CODE;

return new Test("WorkerMessage", {
        disable:    false,
        browser:    true,
        worker:     false,
        node:       false,
        button:     true,
        both:       true, // test the primary module and secondary module
    }).add([
        testWorkerMessage,
        testWorkerMessageCloseCancelAndForceClose,
        testWorkerMessageBarkWatchdog,
        testWorkerMessageErrorInWorkerMessage,
        testWorkerMessageErrorInWorker,
        testWorkerMessageCloseSelf,
    ]).run().clone();

function testWorkerMessage(test, pass, miss) {

    // [1] MainThread   | worker.post("HELLO")
    // [2] WorkerThread | worker.post(event.data + " WORLD") に加工して返す
    // [3] MainThread   | "HELLO WORLD" を受け取る
    // [4] MainThread   | worker.close()
    // [5] WorkerThread | ready()
    // [6] MainThread   | handleClose(EXIT_CODE.OK) が呼ばれる事を確認する

    var valid = false;

    var worker = new WorkerMessage("worker1.js", function(event) {
            console.log(event.data); // "HELLO WORLD"
            valid = event.data === "HELLO WORLD"; // [3]
            worker.close(); // [4]
        }, function(exitCode, errorMessage) { // [6]
            switch (exitCode) {
            case EXIT_CODE.OK:
                if (valid) {
                    test.done(pass());
                    return;
                }
            case EXIT_CODE.ERROR:
            case EXIT_CODE.FORCE:
            case EXIT_CODE.TIMEOUT:
            }
            test.done(miss());
        });

    worker.post("HELLO"); // [1]
}

function testWorkerMessageCloseCancelAndForceClose(test, pass, miss) {

    // [1] MainThread   | worker.close() を要求
    // [2] WorkerThread | cancel() を実行し、closeを拒否 -> handleClose は呼ばれない
    // [3] MainThread   | 1.5秒経過しても Workerが生存していることを確認し、worker.close(-1) で強制終了
    //                  | -> handleClose(EXIT_CODE.FORCE)が呼ばれる
    // [4] MainThread   | 2.0秒後に強制終了が成功している事を確認

    var valid = false;

    var worker = new WorkerMessage("worker2.js", function(event) {
            console.log(event.data); // "HELLO WORLD"
            worker.close(1000); // -> cancel // [1]

            setTimeout(function() {
                if ( worker.isAlive() ) { // close canceled // [3]
                    worker.close(-1); // force close!! -> handleClose(EXIT_CODE.FORCE)
                } else {
                    test.done(miss());
                }
            }, 1500);
            setTimeout(function() {
                if ( valid && !worker.isAlive() ) { // close canceled // [4]
                    test.done(pass());
                } else {
                    test.done(miss());
                }
            }, 2000);
        }, function(exitCode, errorMessage) {
            switch (exitCode) {
            case EXIT_CODE.FORCE: valid = true;
            case EXIT_CODE.OK:
            case EXIT_CODE.ERROR:
            case EXIT_CODE.TIMEOUT:
            }
        });

    worker.post("HELLO");
}

function testWorkerMessageBarkWatchdog(test, pass, miss) {

    // [1] MainThread   | worker.close(1000) を要求
    // [2] WorkerThread | ready() も cancel() も返さない
    // [3] MainThread   | 1.0秒後にwatchdogが発動し自動でデストラクタが走る -> handleClose(EXIT_CODE.TIMEOUT) が呼ばれる
    // [4] MainThread   | 1.5秒後に終了している事を確認
    // [5] MainThread   | watchdog が発動した場合は handleClose(reason) は呼ばれない
    var valid = false;

    var worker = new WorkerMessage("worker3.js", function(event) {
            console.log(event.data); // "HELLO WORLD"
            worker.close(1000); // -> no response... [1]

            setTimeout(function() {
                if ( valid && !worker.isAlive() ) { // [4]
                    test.done(pass());
                } else {
                    test.done(miss());
                }
            }, 1500);
        }, function(exitCode, errorMessage) { // [3]
            switch (exitCode) {
            case EXIT_CODE.TIMEOUT: valid = true;
            case EXIT_CODE.OK:
            case EXIT_CODE.ERROR:
            case EXIT_CODE.FORCE:
            }
        });

    worker.post("HELLO");
}

function testWorkerMessageErrorInWorkerMessage(test, pass, miss) {

    // [1] WorkerThread | WorkerThread 内部で例外発生
    // [2] MainThread   | handleClose(EXIT_CODE.ERROR) が呼ばれる
    // [3] MainThread   | 1秒後に終了している事を確認
    var valid = false;

    var worker = new WorkerMessage("worker4.js", function(event) {
            console.log(event.data); // "HELLO WORLD"
            worker.close();

            setTimeout(function() {
                if (valid && !worker.isAlive()) { // [3]
                    test.done(pass());
                } else {
                    test.done(miss());
                }
            }, 1000);

        }, function(exitCode, errorMessage) { // [2]
            switch (exitCode) {
            case EXIT_CODE.ERROR: valid = true;
            case EXIT_CODE.OK:
            case EXIT_CODE.FORCE:
            case EXIT_CODE.TIMEOUT:
            }
        });

    worker.post("HELLO");
}

function testWorkerMessageErrorInWorker(test, pass, miss) {

    // [1] WorkerThread | WorkerThread の外側(importScriptの次あたりで)で例外発生
    // [2] MainThread   | handleClose(EXIT_CODE.ERROR) が呼ばれる
    // [3] MainThread   | 2秒後に終了している事を確認
    var valid = false;

    setTimeout(function() {
        if (valid && !worker.isAlive()) { // [3]
            test.done(pass());
        } else {
            test.done(miss());
        }
    }, 2000);

    var worker = new WorkerMessage("worker5.js", function(event) {
            //console.log(event.data); // "HELLO WORLD"
            //worker.close();

        }, function(exitCode, errorMessage) { // [2]
            switch (exitCode) {
            case EXIT_CODE.ERROR: valid = true;
            case EXIT_CODE.OK:
            case EXIT_CODE.FORCE:
            case EXIT_CODE.TIMEOUT:
            }
        });

    worker.post("HELLO");
}

function testWorkerMessageCloseSelf(test, pass, miss) {

    // [1] WorkerThread | worker.close() で自分自身を閉じる
    // [2] MainThread   | handleClose(EXIT_CODE.OK) が呼ばれる
    // [3] MainThread   | 2秒後に終了している事を確認
    var valid = false;

    setTimeout(function() {
        if (valid && !worker.isAlive()) { // [3]
            test.done(pass());
        } else {
            test.done(miss());
        }
    }, 2000);

    var worker = new WorkerMessage("worker6.js", function(event) {
            //console.log(event.data); // "HELLO WORLD"
            //worker.close();

        }, function(exitCode, errorMessage) { // [2]
            switch (exitCode) {
            case EXIT_CODE.OK: valid = true;
            case EXIT_CODE.ERROR:
            case EXIT_CODE.FORCE:
            case EXIT_CODE.TIMEOUT:
            }
        });

    worker.post("HELLO");
}




})((this || 0).self || global);

