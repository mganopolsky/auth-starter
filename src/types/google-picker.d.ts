// Minimal typings for the parts of Google's Picker API this app uses.
// https://developers.google.com/workspace/drive/picker/reference

declare namespace google.picker {
  const ViewId: { FOLDERS: string };
  const Action: { PICKED: string; CANCEL: string };

  interface Document {
    id: string;
    name: string;
  }

  interface ResponseObject {
    action: string;
    docs?: Document[];
  }

  class DocsView {
    constructor(viewId?: string);
    setIncludeFolders(include: boolean): DocsView;
    setSelectFolderEnabled(enabled: boolean): DocsView;
    setMimeTypes(mimeTypes: string): DocsView;
  }

  class Picker {
    setVisible(visible: boolean): void;
  }

  class PickerBuilder {
    addView(view: DocsView): PickerBuilder;
    setOAuthToken(token: string): PickerBuilder;
    setDeveloperKey(key: string): PickerBuilder;
    setAppId(appId: string): PickerBuilder;
    setCallback(callback: (data: ResponseObject) => void): PickerBuilder;
    build(): Picker;
  }
}

interface Window {
  gapi?: {
    load(api: string, options: { callback: () => void; onerror?: () => void }): void;
  };
}
