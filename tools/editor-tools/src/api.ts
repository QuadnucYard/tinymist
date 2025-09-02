import type { fontsExportConfigure } from "./features/summary";

const vscodeAPI = typeof acquireVsCodeApi !== "undefined" && acquireVsCodeApi();

function postMessage<T extends { type: string }>(message: T) {
  vscodeAPI?.postMessage?.(message);
}

function postMessageOrFallback<T extends { type: string }>(message: T, fallback: () => void) {
  if (vscodeAPI?.postMessage) {
    postMessage(message);
  } else {
    fallback();
  }
}

export function requestSavePackageData(data: unknown) {
  postMessage({ type: "savePackageData", data });
}

export function requestSaveFontsExportConfigure(data: fontsExportConfigure) {
  postMessage({ type: "saveFontsExportConfigure", data });
}

export function requestInitTemplate(packageSpec: string) {
  postMessage({ type: "initTemplate", packageSpec });
}

export function requestRevealPath(path: string) {
  postMessage({ type: "revealPath", path });
}

export function stopServerProfiling() {
  postMessage({ type: "stopServerProfiling" });
}

export function copyToClipboard(content: string) {
  if (!content) {
    return;
  }

  postMessageOrFallback({ type: "copyToClipboard", content }, () => {
    // copy to clipboard
    navigator.clipboard.writeText(content);
  });
}

export interface TextEdit {
  range?: undefined;
  newText:
    | string
    | {
        kind: "by-mode";
        math?: string;
        markup?: string;
        code?: string;
        rest?: string;
      };
}

export function requestTextEdit(edit: TextEdit) {
  postMessageOrFallback({ type: "editText", edit }, () => {
    // copy to clipboard
    navigator.clipboard.writeText(
      typeof edit.newText === "string"
        ? edit.newText
        : edit.newText.code || edit.newText.rest || "",
    );
  });
}

export function saveDataToFile({
  data,
  path,
  option,
}: {
  data: string;
  path?: string;
  option?: Record<string, unknown>;
}) {
  postMessage({ type: "saveDataToFile", data, path, option });
}

export function requestGeneratePreview(format: string, extraArgs: Record<string, unknown>) {
  postMessage({ type: "generatePreview", format, extraArgs: extraArgs ?? {} });
}

export function requestExportDocument(format: string, extraArgs: Record<string, unknown>) {
  postMessage({ type: "exportDocument", format, extraArgs: extraArgs ?? {} });
}
