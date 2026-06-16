export type NotebookStorageSettings = {
    connectionId: string
    connectionName: string
    endpointUrl: string
    region: string
    forcePathStyle: boolean
    accessKeyId: string
    hasSecretAccessKey: boolean
    bucketName: string
}

export type NotebookStorageSettingsInput = {
    connectionId?: string
    connectionName: string
    endpointUrl: string
    region: string
    forcePathStyle: boolean
    accessKeyId: string
    secretAccessKey?: string
    bucketName: string
}

export type UploadedNotebookAsset = {
    id: string
    url: string
    fileName: string
    contentType: string
    byteSize: number
}

export const emptyNotebookStorageSettings: NotebookStorageSettingsInput = {
    connectionName: "",
    endpointUrl: "",
    region: "us-east-1",
    forcePathStyle: false,
    accessKeyId: "",
    secretAccessKey: "",
    bucketName: "",
}
