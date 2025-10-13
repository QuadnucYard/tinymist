import * as vscode from "vscode";
import { l10nMsg } from "../l10n";
import { tinymist } from "../lsp";
import { IContext } from "../context";
import { commands } from "vscode";

export type ExportKind = "Pdf" | "Html" | "Svg" | "Png" | "Markdown" | "TeX" | "Text" | "Query";

export function exportActivate(context: IContext) {
  context.subscriptions.push(
    commands.registerCommand("tinymist.exportCurrentPdf", () => commandExport("Pdf")),
    commands.registerCommand("tinymist.export", commandExport),
    commands.registerCommand("tinymist.exportCurrentFile", commandAskAndExport),
    commands.registerCommand("tinymist.showPdf", () => commandShow("Pdf")),
    commands.registerCommand("tinymist.exportCurrentFileAndShow", commandAskAndShow),
  );
}

export interface QuickExportFormatMeta {
  label: string;
  description: string;
  exportKind: ExportKind;
  extraOpts?: any;
}

export const quickExports: QuickExportFormatMeta[] = [
  {
    label: "PDF",
    description: l10nMsg("export-pdf.description"),
    exportKind: "Pdf",
  },
  {
    label: l10nMsg("export-png-merged.label"),
    description: l10nMsg("export-png-merged.description"),
    exportKind: "Png",
    extraOpts: { page: { merged: { gap: "0pt" } } },
  },
  {
    label: l10nMsg("export-svg-merged.label"),
    description: l10nMsg("export-svg-merged.description"),
    exportKind: "Svg",
    extraOpts: { page: { merged: { gap: "0pt" } } },
  },
  {
    label: "HTML",
    description: l10nMsg("export-html.description"),
    exportKind: "Html",
  },
  {
    label: "Markdown",
    description: l10nMsg("export-markdown.description"),
    exportKind: "Markdown",
  },
  {
    label: "TeX",
    description: l10nMsg("export-tex.description"),
    exportKind: "TeX",
  },
  {
    label: "Text",
    description: l10nMsg("export-text.description"),
    exportKind: "Text",
  },
  // {
  //   label: "Query (JSON)",
  //   description: l10nMsg("export-query-json.description"),
  //   exportKind: "Query",
  // },
  // {
  //   label: "Query (YAML)",
  //   description: l10nMsg("export-query-yaml.description"),
  //   exportKind: "Query",
  // },
  // {
  //   label: "Query (Task)",
  //   description: l10nMsg("export-query-task.description"),
  //   exportKind: "Query",
  // },
  {
    label: l10nMsg("export-png-first.label"),
    description: l10nMsg("export-png-first.description"),
    exportKind: "Png",
  },
  // {
  //   label: l10nMsg("export-png-task.label"),
  //   description: l10nMsg("export-png-task.description"),
  //   exportKind: "Png",
  // },
  {
    label: l10nMsg("export-svg-first.label"),
    description: l10nMsg("export-svg-first.description"),
    exportKind: "Svg",
  },
  // {
  //   label: l10nMsg("export-svg-task.label"),
  //   description: l10nMsg("export-svg-task.description"),
  //   exportKind: "Svg",
  // },
];

async function askAndRun<T>(
  title: string,
  cb: (meta: QuickExportFormatMeta) => T,
): Promise<T | undefined> {
  const picked = await vscode.window.showQuickPick(quickExports, { title });

  if (picked === undefined) {
    return;
  }

  if (picked.exportKind === "TeX") {
    picked.extraOpts = picked.extraOpts || {};
    const processor = await vscode.window.showInputBox({
      title: l10nMsg("export-tex-processor.title"),
      placeHolder: l10nMsg("export-tex-processor.placeholder"),
      prompt: l10nMsg("export-tex-processor.prompt"),
    });

    if (processor) {
      picked.extraOpts.processor = processor;
    }
  }

  return cb(picked);
}

export async function commandAskAndExport(): Promise<string | undefined> {
  return await askAndRun(l10nMsg("export-pick.title"), (picked) => {
    return commandExport(picked.exportKind, picked.extraOpts);
  });
}

export async function commandAskAndShow(): Promise<void> {
  return await askAndRun(l10nMsg("export-pick-show.title"), (picked) => {
    return commandShow(picked.exportKind, picked.extraOpts);
  });
}

export async function commandExport(kind: ExportKind, opts?: any): Promise<string | undefined> {
  const uri = vscode.window.activeTextEditor?.document.uri.fsPath;
  if (!uri) {
    return;
  }

  return (await tinymist[`export${kind}`](uri, opts)) || undefined;
}

/**
 * Implements the functionality for the 'Show PDF' button shown in the editor title
 * if a `.typ` file is opened.
 */
export async function commandShow(kind: ExportKind, extraOpts?: any): Promise<void> {
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor === undefined) {
    return;
  }

  const conf = vscode.workspace.getConfiguration("tinymist");
  const openIn: string = conf.get("showExportFileIn") || "editorTab";

  // Telling the language server to open the file instead of using
  // ```
  // vscode.env.openExternal(exportUri);
  // ```
  // , which is buggy.
  //
  // See https://github.com/Myriad-Dreamin/tinymist/issues/837
  // Also see https://github.com/microsoft/vscode/issues/85930
  const openBySystemDefault = openIn === "systemDefault";
  if (openBySystemDefault) {
    extraOpts = extraOpts || {};
    extraOpts.open = true;
  }

  // only create pdf if it does not exist yet
  const exportPath = await commandExport(kind, extraOpts);

  if (exportPath === undefined) {
    // show error message
    await vscode.window.showErrorMessage(`Failed to export ${kind}`);
    return;
  }

  switch (openIn) {
    case "systemDefault":
      break;
    default:
      vscode.window.showWarningMessage(
        `Unknown value of "tinymist.showExportFileIn", expected "systemDefault" or "editorTab", got "${openIn}"`,
      );
    // fall through
    case "editorTab": {
      // find and replace exportUri
      const exportUri = vscode.Uri.file(exportPath);
      const uriToFind = exportUri.toString();
      findTab: for (const editor of vscode.window.tabGroups.all) {
        for (const tab of editor.tabs) {
          if ((tab.input as any)?.uri?.toString() === uriToFind) {
            await vscode.window.tabGroups.close(tab, true);
            break findTab;
          }
        }
      }

      // here we can be sure that the pdf exists
      await commands.executeCommand("vscode.open", exportUri, {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: true,
      } as vscode.TextDocumentShowOptions);
      break;
    }
  }
}
