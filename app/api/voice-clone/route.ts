import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Forward the request to ElevenLabs
    const formData = await request.formData()
    
    // Log the form data entries
    console.log('Form data entries:')
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`${key}:`, {
          name: value.name,
          type: value.type,
          size: value.size
        })
      } else {
        console.log(`${key}:`, value)
      }
    }
    
    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY || ''
      },
      body: formData
    })

    // Get the response data
    const data = await response.json()
    
    // Log the response for debugging
    console.log('ElevenLabs response:', {
      status: response.status,
      data
    })

    // If ElevenLabs returns an error, maintain the same error format
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    // Return the successful response
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in voice clone API:', error)
    return NextResponse.json(
      { detail: { message: 'Internal server error' } },
      { status: 500 }
    )
  }
} 