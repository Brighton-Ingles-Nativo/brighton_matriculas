import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const config = () => {
  const values = {
    region: process.env.AWS_REGION,
    bucket: process.env.AWS_BUCKET_NAME,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }

  const missing = Object.entries({
    AWS_REGION: values.region,
    AWS_BUCKET_NAME: values.bucket,
    AWS_ACCESS_KEY_ID: values.accessKeyId,
    AWS_SECRET_ACCESS_KEY: values.secretAccessKey,
  }).filter(([, value]) => !value).map(([name]) => name)

  if (missing.length) {
    console.error('[S3] Configuración incompleta', { missing })
    throw createError({ statusCode: 500, message: 'El almacenamiento S3 no está configurado.' })
  }

  return values
}

const logS3Error = (operation: string, error: unknown) => {
  const awsError = error as { name?: string; code?: string; message?: string; $metadata?: { requestId?: string; httpStatusCode?: number } }
  console.error('[S3] Error en operación', {
    operation,
    name: awsError?.name,
    code: awsError?.code,
    message: awsError?.message,
    requestId: awsError?.$metadata?.requestId,
    httpStatusCode: awsError?.$metadata?.httpStatusCode,
  })
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
  try {
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }))
  } catch (error) {
    logS3Error('upload', error)
    throw error
  }
}

export async function removeS3Object(key: string | null | undefined) {
  if (!key) return
  const { client, bucket } = getClient()
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  } catch (error) {
    logS3Error('delete', error)
    throw error
  }
}

export async function getS3DownloadUrl(key: string, contentType: string, fileName: string) {
  const { client, bucket } = getClient()
  try {
    return await getSignedUrl(client, new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentType: contentType,
      ResponseContentDisposition: `inline; filename="${fileName.replace(/[\r\n"]/g, '')}"`,
    }), { expiresIn: 60 * 60 })
  } catch (error) {
    logS3Error('download-url', error)
    throw error
  }
}
