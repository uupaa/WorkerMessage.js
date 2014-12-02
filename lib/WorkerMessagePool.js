(function(global) {
"use strict";

// --- dependency modules ----------------------------------
// --- define / local variables ----------------------------
//var _runOnNode = "process" in global;
//var _runOnWorker = "WorkerLocation" in global;
//var _runOnBrowser = "document" in global;

// --- class / interfaces ----------------------------------
function WorkerMessagePool(workerMessages) { // @arg WorkerMessageArray [worker, ...]
//{@dev
    $valid($type(workerMessages, "WorkerMessageArray"), WorkerMessagePool, "workerMessages");
//}@dev

    this._counter = 0;
    this._pool = workerMessages;
}

WorkerMessagePool["prototype"] = {
    "constructor":  WorkerMessagePool,          // new WorkerMessagePool(nodes:Number|Integer):WorkerMessagePool
    "get":          WorkerMessagePool_get,      // WorkerMessagePool#get():WorkerMessage
    "add":          WorkerMessagePool_add,      // WorkerMessagePool#add(thread:WorkerMessage):this
    "remove":       WorkerMessagePool_remove,   // WorkerMessagePool#remove(thread:WorkerMessage):this
    "clear":        WorkerMessagePool_clear     // WorkerMessagePool#clear():void
};

// --- implements ------------------------------------------
function WorkerMessagePool_get() { // @ret WorkerMessage
                                   // @raise Error("No active thread")
                                   // @desc Round-Robin
    var activeThreads = _enumActiveThreads();

    if (!activeThreads.length) {
        throw new Error("No active thread");
    }
    return activeThreads[++this._counter % activeThreads.length];
}

function _enumActiveThreads(pool) {
    var result = [];

    for (var i = 0, iz = this._pool.length; i < iz; ++i) {
        if ( pool[i]["isActive"]() ) {
            result.push( pool[i] );
        }
    }
    return result;
}

function WorkerMessagePool_add(thread) { // @arg WorkerMessage
                                         // @ret this
//{@dev
    $valid($type(thread, "WorkerMessage"), WorkerMessagePool_add, "thread");
//}@dev

    if (thread in this._pool) {
        // already exists
    } else {
        this._pool.push(thread);
    }
    return this;
}

function WorkerMessagePool_remove(thread) { // @arg WorkerMessage
                                            // @ret this
//{@dev
    $valid($type(thread, "WorkerMessage"), WorkerMessagePool_remove, "thread");
//}@dev

    if (thread in this._pool) {
        var pos = this._pool.indexOf(thread);
        if (pos >= 0) {
            this._pool.splice(pos, 1);
        }
    } else {
        // not exists
    }
    return this;
}

function WorkerMessagePool_clear() { // @ret Boolean comment
    this._counter = 0;
    this._pool = [];
}

// --- validate / assertions -------------------------------
//{@dev
function $valid(val, fn, hint) { if (global["Valid"]) { global["Valid"](val, fn, hint); } }
function $type(obj, type) { return global["Valid"] ? global["Valid"].type(obj, type) : true; }
//function $keys(obj, str) { return global["Valid"] ? global["Valid"].keys(obj, str) : true; }
//function $some(val, str, ignore) { return global["Valid"] ? global["Valid"].some(val, str, ignore) : true; }
//function $args(fn, args) { if (global["Valid"]) { global["Valid"].args(fn, args); } }

if (global["Valid"]) {
    global["Valid"]["register"]("WorkerMessageArray", function(type, value) {
        return value.every(function(v) {
            return $type(v, "WorkerMessage");
        });
    });
}
//}@dev

// --- exports ---------------------------------------------
if ("process" in global) {
    module["exports"] = WorkerMessagePool;
}
global["WorkerMessagePool" in global ? "WorkerMessagePool_" : "WorkerMessagePool"] = WorkerMessagePool; // switch module. http://git.io/Minify

})((this || 0).self || global); // WebModule idiom. http://git.io/WebModule

