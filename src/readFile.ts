import * as fs from 'fs'

const readFile = (path: string): string => {
  try {
    return fs.readFileSync(path, 'utf8')
  } catch {
    throw new Error(`could not read file ${path}`)
  }
}

export default readFile
