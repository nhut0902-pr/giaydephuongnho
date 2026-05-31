const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const scriptTag = '<script src=\"/js/push-client.js?v=4\"></script>';

function injectScript(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            injectScript(fullPath);
        } else if (file.endsWith('.html') && file !== 'google003c285f4d4d03ea.html') {
            let content = fs.readFileSync(fullPath, 'utf8');
            if (!content.includes('push-client.js')) {
                content = content.replace('</body>', '    ' + scriptTag + '\n</body>');
                fs.writeFileSync(fullPath, content);
                console.log(`Injected into ${fullPath}`);
            }
        }
    });
}

injectScript(publicDir);
console.log('Done injecting script.');
