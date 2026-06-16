import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import type { Readable } from "stream"

export type S3ConnectionConfig = {
    endpointUrl: string | null
    region: string
    forcePathStyle: boolean
    accessKeyId: string
    secretAccessKey: string
}

export type UploadS3ObjectInput = {
    connection: S3ConnectionConfig
    bucketName: string
    objectKey: string
    body: Buffer
    contentType: string
    metadata?: Record<string, string>
}

export type ReadS3ObjectInput = {
    connection: S3ConnectionConfig
    bucketName: string
    objectKey: string
}

export const createS3Client = (connection: S3ConnectionConfig) =>
    new S3Client({
        endpoint: connection.endpointUrl || undefined,
        forcePathStyle: connection.forcePathStyle,
        region: connection.region || "us-east-1",
        credentials: {
            accessKeyId: connection.accessKeyId,
            secretAccessKey: connection.secretAccessKey,
        },
    })

export const uploadS3Object = async ({ connection, bucketName, objectKey, body, contentType, metadata }: UploadS3ObjectInput) => {
    const client = createS3Client(connection)
    await client.send(
        new PutObjectCommand({
            Body: body,
            Bucket: bucketName,
            ContentType: contentType,
            Key: objectKey,
            Metadata: metadata,
        }),
    )
}

export const readS3Object = async ({ connection, bucketName, objectKey }: ReadS3ObjectInput) => {
    const client = createS3Client(connection)
    const result = await client.send(
        new GetObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
        }),
    )

    return {
        body: result.Body as Readable | undefined,
        contentLength: result.ContentLength,
        contentType: result.ContentType,
    }
}
