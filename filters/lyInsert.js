const fs = require('fs');
const os = require('os');
const which = require('which');  // for which
const temp = require('temp')     //.track() // for temp
const {execSync} = require('child_process');
const path = require('path');

module.exports = function(contents, outputFilename, centerP) {
  if (outputFilename === undefined) {
    return "Fail lyinsert!";
  }
  if (centerP === undefined) {
    centerP = true;
  }
  const ly = which.sync('lilypond');
  const info = temp.openSync({prefix: 'lyInsert-', suffix: '.ly'});
  console.log(info.path);
  fs.writeSync(info.fd, contents);
  fs.closeSync(info.fd);

  const outputSvg = `${info.path}.svg`;
  // The output filename is the 11ty folder for images.
  // Currently _11ty/_static/img
  const outputPath = `${path.dirname(__dirname)}/src/_11ty/_static/img/${outputFilename}`;
  console.log(`SVG file saved to ${outputPath}`);

  const croppedSvg = `${info.path}.cropped.svg`
  execSync(ly + ` -s -dcrop --svg -o ${info.path}  ${info.path}`, { stdio: [0, 1, 2] });
  
  // Copy file from croppedSvg to destination in outputPath
  fs.copyFileSync(croppedSvg, outputPath);

  // However, when the image is served, it's found in  /img/
  const img = `<img src="/img/${outputFilename}"/>`;
  if (centerP) {
    return `<div style="text-align:center;">${img}</div>`
  }
  return `<div>${img}</div>`
}