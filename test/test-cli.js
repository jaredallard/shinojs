/**
 * Shinojs test file, uses nodeunit
 *
 * @license MIT
 **/


var exec  = require('child_process').exec,
    spawn = require('child_process').spawn,
    fs    = require('fs'),
    path  = require('path');

// borrowed from forever
var kill = function (pid, signal, callback) {
    signal   = signal || 'SIGKILL';
    callback = callback || function () {};
    var killTree = true;
    if(killTree) {
        psTree(pid, function (err, children) {
            [pid].concat(
                children.map(function (p) {
                    return p.PID;
                })
            ).forEach(function (tpid) {
                try { process.kill(tpid, signal) }
                catch (ex) { }
            });
            callback();
        });
    } else {
        try { process.kill(pid, signal) }
        catch (ex) { }
        callback();
    }
};

exports['fails on no commands.json'] = function (test) {
  if(fs.existsSync('commands.json')) {
    if(fs.existsSync('commands.before-test.json')) {
      fs.unlinkSync('commands.json');
    } else {
      console.log("WARNING: Your commands.json has been moved to commands.before-test.json");
      console.log("ANY changes to commands.json will be deleted from now on, until that file is gone.");
      fs.createReadStream('commands.json').pipe(fs.createWriteStream('commands.before-test.json')); // copy the file
      fs.unlinkSync('commands.json'); // delete it
    }
  }

  exec('node index.js', function (err, stdout, stderr) {
    if(err) {
      test.done();
    } else {
      test.ok(false);
      test.done();
    }
  });
};

exports['shows initial prompt when a command.json is present'] = function (test) {
  fs.createReadStream('commands.example.json').pipe(fs.createWriteStream('commands.json')); // copy the file
  var ind = spawn('node', ['index.js']);
  ind.stdout.on('data', function(data) {
    test.ok(/prompt/g.test(data));
    test.done();
    try {
      ind.stdin.pause();
      ind.kill();
    } catch(err) {
      // we don't care about kill errors in this test.
    }
  });
  ind.stderr.on('data', function(err) {
    test.ok(false);
    test.done();
  });
};

exports['doesn\'t throw an error on prompt abortion'] = function(test) {
  fs.createReadStream('commands.example.json').pipe(fs.createWriteStream('commands.json')); // copy the file
  var child = exec('node index.js');
  child.stdout.on('data', function(data) {
    var isWin = /^win/.test(process.platform);
    if(!isWin) {
      kill(child.pid);
    } else {
      var cp = require('child_process');
      cp.exec('taskkill /PID ' + child.pid + ' /T /F', function (error, stdout, stderr) {
          // console.log('stdout: ' + stdout);
          // console.log('stderr: ' + stderr);
          // if(error !== null) {
          //      console.log('exec error: ' + error);
          // }
      });
    }
  });
  child.on('close', function(code) {
    fs.unlinkSync('commands.json'); // delete it
    test.ok(code);
    test.done();
  });
}
