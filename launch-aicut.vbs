' AICut launcher — starts the editor without a visible console window.
' If a production build exists (release\...\AICut.exe) it launches that directly;
' otherwise it falls back to the dev server (npm run dev).
Option Explicit
Dim shell, fso, projDir, exe, found, f, releaseDir, sub
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

projDir = fso.GetParentFolderName(WScript.ScriptFullName)
found = ""

releaseDir = fso.BuildPath(projDir, "release")
If fso.FolderExists(releaseDir) Then
  ' look for an installed/portable AICut.exe under release\*
  Dim folder, file
  For Each sub In fso.GetFolder(releaseDir).SubFolders
    For Each file In sub.Files
      If LCase(fso.GetExtensionName(file.Name)) = "exe" And InStr(LCase(file.Name), "setup") = 0 Then
        found = file.Path
      End If
    Next
  Next
End If

If found <> "" Then
  shell.Run """" & found & """", 1, False
Else
  ' Dev fallback — launch vite + Electron, hidden console
  shell.CurrentDirectory = projDir
  shell.Run "cmd /c npm run dev", 0, False
End If
