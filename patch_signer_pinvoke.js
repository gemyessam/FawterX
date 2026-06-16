const fs = require('fs');
let c = fs.readFileSync('signer.cs', 'utf8');

const pinvokeTarget = `    class Program
    {`;
const pinvokeReplacement = `    class Program
    {
        [System.Runtime.InteropServices.DllImport("kernel32.dll")]
        static extern IntPtr GetConsoleWindow();

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        [return: System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.Bool)]
        static extern bool SetForegroundWindow(IntPtr hWnd);`;

c = c.replace(pinvokeTarget, pinvokeReplacement);

fs.writeFileSync('signer.cs', c);
console.log("SUCCESSFULLY PATCHED PInvoke!");
