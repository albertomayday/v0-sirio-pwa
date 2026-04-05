import fs from 'fs'
import path from 'path'

export default function Home() {
  try {
    const indexPath = path.join(process.cwd(), 'public', 'index.html')
    const content = fs.readFileSync(indexPath, 'utf-8')
    
    return (
      <div dangerouslySetInnerHTML={{ __html: content }} />
    )
  } catch (error) {
    console.error('Error reading index.html:', error)
    return <div>Error loading content</div>
  }
}
