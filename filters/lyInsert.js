const fs = require('fs');
const os = require('os');
const which = require('which');  // for which
const temp = require('temp')     //.track() // for temp
const {execSync} = require('child_process');

module.exports = function(contents) {
  const ly = which.sync('lilypond');
  const info = temp.openSync({prefix: 'lyInsert-', suffix: '.ly'});
  console.log(info.path);
  fs.writeSync(info.fd, contents);
  fs.closeSync(info.fd);

  const outputSvg = `${info.path}.svg`
  const croppedSvg = `${info.path}.cropped.svg`
  execSync(ly + ` -s -dcrop --svg -o ${info.path}  ${info.path}`, { stdio: [0, 1, 2] });
  const data = fs.readFileSync(croppedSvg);
  return data.toString('utf8');
}