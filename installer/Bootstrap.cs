using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Text;
using System.Windows.Forms;

internal static class Bootstrap {
  [STAThread]
  private static int Main(string[] args) {
    bool extractOnly = args.Length == 2 && args[0] == "--extract-only";
    try {
      string destination = extractOnly ? Path.GetFullPath(args[1]) : Path.Combine(Path.GetTempPath(), "agent-peer-install-" + Guid.NewGuid().ToString("N"));
      if (Directory.Exists(destination) && Directory.GetFileSystemEntries(destination).Length != 0) throw new InvalidOperationException("Extraction folder must be empty.");
      Directory.CreateDirectory(destination);
      string zip = Path.Combine(destination, "payload.zip");
      using (Stream input = Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip")) {
        if (input == null) throw new InvalidOperationException("Installer payload is missing.");
        using (FileStream output = File.Create(zip)) input.CopyTo(output);
      }
      ZipFile.ExtractToDirectory(zip, destination);
      if (extractOnly) return 0;
      string powershell = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "WindowsPowerShell", "v1.0", "powershell.exe");
      string script = Path.Combine(destination, "agent-peer-bridge", "scripts", "Setup.ps1");
      StringBuilder log = new StringBuilder();
      ProcessStartInfo info = new ProcessStartInfo(powershell, "-NoProfile -ExecutionPolicy Bypass -File \"" + script + "\"");
      info.UseShellExecute = false;
      info.CreateNoWindow = true;
      info.RedirectStandardOutput = true;
      info.RedirectStandardError = true;
      info.StandardOutputEncoding = Encoding.UTF8;
      info.StandardErrorEncoding = Encoding.UTF8;
      int exitCode;
      using (Process process = new Process()) {
        process.StartInfo = info;
        process.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e) { if (e.Data != null) lock(log) log.AppendLine(e.Data); };
        process.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs e) { if (e.Data != null) lock(log) log.AppendLine(e.Data); };
        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        process.WaitForExit();
        exitCode = process.ExitCode;
      }
      string app = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AgentPeerBridge");
      Directory.CreateDirectory(app);
      string logPath = Path.Combine(app, "install.log");
      File.WriteAllText(logPath, log.ToString(), Encoding.UTF8);
      if (exitCode != 0) throw new InvalidOperationException("Installation failed.\n" + log.ToString() + "\nLog: " + logPath);
      MessageBox.Show("Agent Peer Bridge installed.\n\nRestart Codex and Claude Code chats.\nCodex: $claude-discuss\nClaude Code: /codex-discuss\n\nUse your subscription CLI login if prompted.\nInstallation log: " + logPath, "Agent Peer Bridge", MessageBoxButtons.OK, MessageBoxIcon.Information);
      return 0;
    } catch (Exception error) {
      if (!extractOnly) MessageBox.Show(error.Message, "Agent Peer Bridge installation", MessageBoxButtons.OK, MessageBoxIcon.Error);
      return 1;
    }
  }
}
