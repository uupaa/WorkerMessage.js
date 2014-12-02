var ModuleTestWorkerMessage = (function(global) {

var _runOnNode = "process" in global;
var _runOnWorker = "WorkerLocation" in global;
var _runOnBrowser = "document" in global;

var EXIT_CODE_OK      = WorkerMessage.EXIT_CODE_OK;
var EXIT_CODE_ERROR   = WorkerMessage.EXIT_CODE_ERROR;
var EXIT_CODE_FORCE   = WorkerMessage.EXIT_CODE_FORCE;
var EXIT_CODE_TIMEOUT = WorkerMessage.EXIT_CODE_TIMEOUT;

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
        testWorkerMessagePostback,
        testWorkerMessagePostbackWithToken
    ]).run().clone();

function testWorkerMessage(test, pass, miss) {

    // [1] MainThread   | worker.post("HELLO")
    // [2] WorkerThread | worker.post(event.data + " WORLD") に加工して返す
    // [3] MainThread   | "HELLO WORLD" を受け取る
    // [4] MainThread   | worker.close()
    // [5] WorkerThread | ready()
    // [6] MainThread   | handleClose(EXIT_CODE_OK) が呼ばれる事を確認する

    var valid = false;

    var worker = new WorkerMessage("worker1.js", function(message, token, event) {
            console.log(message); // "HELLO WORLD"
            valid = message === "HELLO WORLD"; // [3]
            worker.close(); // [4]
        }, function(exitCode, errorMessage) { // [6]
            switch (exitCode) {
            case EXIT_CODE_OK:
                if (valid) {
                    test.done(pass());
                    return;
                }
            case EXIT_CODE_ERROR:
            case EXIT_CODE_FORCE:
            case EXIT_CODE_TIMEOUT:
            }
            test.done(miss());
        });

    worker.post("HELLO"); // [1]
}

function testWorkerMessageCloseCancelAndForceClose(test, pass, miss) {

    // [1] MainThread   | worker.close() を要求
    // [2] WorkerThread | cancel() を実行し、closeを拒否 -> handleClose は呼ばれない
    // [3] MainThread   | 1.5秒経過しても Workerが生存していることを確認し、worker.close(-1) で強制終了
    //                  | -> handleClose(EXIT_CODE_FORCE)が呼ばれる
    // [4] MainThread   | 2.0秒後に強制終了が成功している事を確認

    var valid = false;

    var worker = new WorkerMessage("worker2.js", function(message, token, event) {
            console.log(message); // "HELLO WORLD"
            worker.close(1000); // -> cancel // [1]

            setTimeout(function() {
                if ( worker.isAlive() ) { // close canceled // [3]
                    worker.close(-1); // force close!! -> handleClose(EXIT_CODE_FORCE)
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
            case EXIT_CODE_FORCE: valid = true;
            case EXIT_CODE_OK:
            case EXIT_CODE_ERROR:
            case EXIT_CODE_TIMEOUT:
            }
        });

    worker.post("HELLO");
}

function testWorkerMessageBarkWatchdog(test, pass, miss) {

    // [1] MainThread   | worker.close(1000) を要求
    // [2] WorkerThread | ready() も cancel() も返さない
    // [3] MainThread   | 1.0秒後にwatchdogが発動し自動でデストラクタが走る -> handleClose(EXIT_CODE_TIMEOUT) が呼ばれる
    // [4] MainThread   | 1.5秒後に終了している事を確認
    // [5] MainThread   | watchdog が発動した場合は handleClose(reason) は呼ばれない
    var valid = false;

    var worker = new WorkerMessage("worker3.js", function(message, token, event) {
            console.log(message); // "HELLO WORLD"
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
            case EXIT_CODE_TIMEOUT: valid = true;
            case EXIT_CODE_OK:
            case EXIT_CODE_ERROR:
            case EXIT_CODE_FORCE:
            }
        });

    worker.post("HELLO");
}

function testWorkerMessageErrorInWorkerMessage(test, pass, miss) {

    // [1] WorkerThread | WorkerThread 内部で例外発生
    // [2] MainThread   | handleClose(EXIT_CODE_ERROR) が呼ばれる
    // [3] MainThread   | 1秒後に終了している事を確認
    var valid = false;

    var worker = new WorkerMessage("worker4.js", function(message, token, event) {
            console.log(message); // "HELLO WORLD"
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
            case EXIT_CODE_ERROR: valid = true;
            case EXIT_CODE_OK:
            case EXIT_CODE_FORCE:
            case EXIT_CODE_TIMEOUT:
            }
        });

    worker.post("HELLO");
}

function testWorkerMessageErrorInWorker(test, pass, miss) {

    // [1] WorkerThread | WorkerThread の外側(importScriptの次あたりで)で例外発生
    // [2] MainThread   | handleClose(EXIT_CODE_ERROR) が呼ばれる
    // [3] MainThread   | 2秒後に終了している事を確認
    var valid = false;

    setTimeout(function() {
        if (valid && !worker.isAlive()) { // [3]
            test.done(pass());
        } else {
            test.done(miss());
        }
    }, 2000);

    var worker = new WorkerMessage("worker5.js", function(message, token, event) {
            //console.log(message); // "HELLO WORLD"
            //worker.close();

        }, function(exitCode, errorMessage) { // [2]
            switch (exitCode) {
            case EXIT_CODE_ERROR: valid = true;
            case EXIT_CODE_OK:
            case EXIT_CODE_FORCE:
            case EXIT_CODE_TIMEOUT:
            }
        });

    worker.post("HELLO");
}

function testWorkerMessageCloseSelf(test, pass, miss) {

    // [1] WorkerThread | worker.close() で自分自身を閉じる
    // [2] MainThread   | handleClose(EXIT_CODE_OK) が呼ばれる
    // [3] MainThread   | 2秒後に終了している事を確認
    var valid = false;

    setTimeout(function() {
        if (valid && !worker.isAlive()) { // [3]
            test.done(pass());
        } else {
            test.done(miss());
        }
    }, 2000);

    var worker = new WorkerMessage("worker6.js", function(message, token, event) {
            //console.log(message); // "HELLO WORLD"
            //worker.close();

        }, function(exitCode, errorMessage) { // [2]
            switch (exitCode) {
            case EXIT_CODE_OK: valid = true;
            case EXIT_CODE_ERROR:
            case EXIT_CODE_FORCE:
            case EXIT_CODE_TIMEOUT:
            }
        });

    worker.post("HELLO");
}

function testWorkerMessagePostback(test, pass, miss) {

    // [1] MainThread   | worker.post("HELLO", token, postback)
    // [2] WorkerThread | worker.post(event.data + " WORLD", null, token) に加工して返す
    // [3] MainThread   | "HELLO WORLD" をポストバックで受け取る
    // [4] MainThread   | worker.close()
    // [5] WorkerThread | ready()
    // [6] MainThread   | handleClose(EXIT_CODE_OK) が呼ばれる事を確認する

    var valid = false;

    var worker = new WorkerMessage("worker7.js", function(message, token, event) {
/*
            console.log(message); // "HELLO WORLD"
            valid = message === "HELLO WORLD"; // [3]
            worker.close(); // [4]
 */
            test.done(miss());
        }, function(exitCode, errorMessage) { // [6]
            switch (exitCode) {
            case EXIT_CODE_OK:
                if (valid) {
                    test.done(pass());
                    return;
                }
            case EXIT_CODE_ERROR:
            case EXIT_CODE_FORCE:
            case EXIT_CODE_TIMEOUT:
            }
            test.done(miss());
        });

    var token = 123; // random value

    worker.post("HELLO", null, token, function(message, postbacktoken, event) { // [1]
        console.log(message); // "HELLO WORLD"
        if (message === "HELLO WORLD" && // [3]
            token === postbacktoken) {
            valid = true;
        }
        worker.close(); // [4]
    });
}

function testWorkerMessagePostbackWithToken(test, pass, miss) {

    // [1] MainThread   | worker.post("HELLO", null, "1234", postback)
    // [2] WorkerThread | worker.post(event.data + " WORLD", null, token) に加工して返す
    // [3] MainThread   | "HELLO WORLD" をポストバックで受け取る
    // [4] MainThread   | worker.close()
    // [5] WorkerThread | ready()
    // [6] MainThread   | handleClose(EXIT_CODE_OK) が呼ばれる事を確認する

    var valid = false;
    var userToken = 1234;

    var worker = new WorkerMessage("worker8.js", function(message, token, event) {
/*
            console.log(message); // "HELLO WORLD"
            valid = message === "HELLO WORLD"; // [3]
            worker.close(); // [4]
 */
            test.done(miss());
        }, function(exitCode, errorMessage) { // [6]
            switch (exitCode) {
            case EXIT_CODE_OK:
                if (valid) {
                    test.done(pass());
                    return;
                }
            case EXIT_CODE_ERROR:
            case EXIT_CODE_FORCE:
            case EXIT_CODE_TIMEOUT:
            }
            test.done(miss());
        });

    worker.post("HELLO", null, userToken, function(message, token, event) { // [1]
        console.log(message); // "HELLO WORLD"
        valid = message === "HELLO WORLD"; // [3]
        worker.close(); // [4]
    });
}


})((this || 0).self || global);

