import fs from 'fs';
import path from 'path';

function copyRecursiveSync(src, dest) {
    if (!fs.existsSync(src)) return;
    const exists = fs.existsSync(dest);
    const stats = exists && fs.statSync(dest);
    const isDirectory = fs.statSync(src).isDirectory();
    if (isDirectory) {
        if (!exists) fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(function(childItemName) {
            copyRecursiveSync(path.join(src, childItemName),
                path.join(dest, childItemName));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

copyRecursiveSync('./code2', '.');
console.log('Migration complete.');
