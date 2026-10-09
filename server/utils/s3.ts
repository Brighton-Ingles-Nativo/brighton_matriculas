import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const config = () => {
  const runtimeConfig = useRuntimeConfig()
  const values = {
    region: runtimeConfig.awsRegion,
    bucket: runtimeConfig.awsBucketName,
    accessKeyId: runtimeConfig.awsAccessKeyId,
    secretAccessKey: runtimeConfig.awsSecretAccessKey,
  }

  if (!values.region || !values.bucket || !values.accessKeyId || !values.secretAccessKey) {
    throw createError({ statusCode: 500, statusMessage: 'El almacenamiento S3 no está configurado.' })
  }

  return values
}

let client: S3Client | null = null

const getClient = () => {
  const values = config()
  client ||= new S3Client({
    region: values.region,
    credentials: {
      accessKeyId: values.accessKeyId,
      secretAccessKey: values.secretAccessKey,
    },
  })
  return { client, bucket: values.bucket }
}

export async function storeS3Object(key: string, body: Buffer, contentType: string) {
  const { client, bucket } = getClient()
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  }))
}

export async function removeS3Object(key: string | null | undefined) {
  if (!key) return
  const { client, bucket } = getClient()
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

export async function getS3DownloadUrl(key: string, contentType: string, fileName: string) {
  const { client, bucket } = getClient()
  return getSignedUrl(client, new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentType: contentType,
    ResponseContentDisposition: `inline; filename="${fileName.replace(/[\r\n"]/g, '')}"`,
  }), { expiresIn: 60 * 60 })
}
