import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Forward the request to ElevenLabs
    const formData = await request.formData()
    
    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY || ''
      },
      body: formData
    })

    // Get the response data
    const data = await response.json()

    // If ElevenLabs returns an error, maintain the same error format
    if (!response.ok) {
        console.log('ElevenLabs response:', {
            status: response.status,
            data
          })
      return NextResponse.json(data, { status: response.status })
    }

    // Return the successful response
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { detail: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
} 