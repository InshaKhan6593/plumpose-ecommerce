export type Theme = 'dark' | 'light'

export interface ThemeContextType {
  setTheme: (theme: Theme | null) => void // eslint-disable-line no-unused-vars
  theme?: Theme | null
}
