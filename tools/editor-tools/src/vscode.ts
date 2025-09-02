import van from "vanjs-core";
export * from "./api"; // compatibility export

const vscodeAPI = typeof acquireVsCodeApi !== "undefined" && acquireVsCodeApi();

interface UserActionTraceRequest {
  compilerProgram: string;
  root: string;
  main: string;
  inputs: any;
  fontPaths: string[];
}

export interface LspResponse {
  id: number;
  result: any;
  error: any;
}

export interface LoC {
  line: number;
  character: number;
}

export interface VscodeDiagnostics {
  path: string;
  message: string;
  range: {
    start: LoC;
    end: LoC;
  };
}

export interface LspNotification {
  method: string;
  params: Record<string, VscodeDiagnostics[]>;
}

export type LspMessage = LspResponse | LspNotification;

interface TraceReport {
  request: UserActionTraceRequest;
  messages: LspMessage[];
  stderr: string;
}

export interface SelectionStyle {
  textDocument: {
    uri: string;
  };
  position: {
    line: number;
    character: number;
  };
  style: string[];
  styleAt: any[];
}

export interface StyleAtCursor {
  version: number;
  selections: SelectionStyle[];
}

// import { traceDataMock } from "./vscode.trace.mock";
// export const traceData = van.state<TraceReport | undefined>(traceDataMock);
export const programTrace = van.state<TraceReport | undefined>(undefined);
export const serverTrace = van.state<any | undefined>(undefined);

export const didStartServerProfiling = van.state<boolean>(false);

export const styleAtCursor = van.state<StyleAtCursor | undefined>(undefined);

// Document URI state with versioning
export interface VersionedDocUri {
  version: number;
  uri: string;
}

export const focusedDocUri = van.state<VersionedDocUri | undefined>(undefined);
export const isDocUriLocked = van.state<boolean>(false);

/// A frontend will try to setup a vscode channel if it is running
/// in vscode.
export function setupVscodeChannel() {
  if (vscodeAPI?.postMessage) {
    // Handle messages sent from the extension to the webview
    window.addEventListener("message", (event: any) => {
      switch (event.data.type) {
        case "traceData": {
          programTrace.val = event.data.data;
          break;
        }
        case "didStartServerProfiling": {
          serverTrace.val = event.data.data;
          break;
        }
        case "styleAtCursor": {
          styleAtCursor.val = event.data.data;
          break;
        }
        case "focusedDocUri": {
          const incomingData = event.data.data as VersionedDocUri;
          // Only update if not locked and version is newer (or no current version)
          if (
            !isDocUriLocked.val &&
            incomingData &&
            incomingData.uri &&
            (!focusedDocUri.val || incomingData.version > focusedDocUri.val.version)
          ) {
            focusedDocUri.val = incomingData;
          }
          break;
        }
        case "previewGenerated": {
          // Handle preview generation response
          // You can dispatch this to the export tool if needed
          window.dispatchEvent(
            new CustomEvent("exportPreviewGenerated", {
              detail: event.data,
            }),
          );
          break;
        }
        case "previewError": {
          // Handle preview generation error
          window.dispatchEvent(
            new CustomEvent("exportPreviewError", {
              detail: event.data,
            }),
          );
          break;
        }
      }
    });
  }
}

class MessageHandler {}

export function subscribeMessage(type: string, callback: (data: any) => void) {}
