(function () {
    "use strict";
    var fs = require('fs'),
        _ = require('./underscore.js')._,
        ss = require('./SchemeScript.js');


    var content = fs.readFileSync('test.ss', 'utf8');
    ss.ss_eval(content);
})();
