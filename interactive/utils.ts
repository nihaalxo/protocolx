export const W = 'w'
export const A = 'a'
export const S = 's'
export const D = 'd'
export const LEFT_MOUSE = 'mouse0'
export const DIRECTIONS = [W, A, S, D]

export class KeyDisplay {
    map: Map<string, HTMLDivElement> = new Map()

    constructor() {
        const w: HTMLDivElement = document.createElement("div")
        const a: HTMLDivElement = document.createElement("div")
        const s: HTMLDivElement = document.createElement("div")
        const d: HTMLDivElement = document.createElement("div")

        this.map.set(W, w)
        this.map.set(A, a)
        this.map.set(S, s)
        this.map.set(D, d)

        this.map.forEach((v, k) => {
            v.style.color = 'blue'
            v.style.fontSize = '50px'
            v.style.fontWeight = '800'
            v.style.position = 'absolute'
            v.textContent = k
        })

        this.updatePosition()

        this.map.forEach((v, _) => {
            document.body.append(v)
        })
    }

    public updatePosition() {
        this.map.get(W)!.style.top = `${window.innerHeight - 150}px`
        this.map.get(A)!.style.top = `${window.innerHeight - 100}px`
        this.map.get(S)!.style.top = `${window.innerHeight - 100}px`
        this.map.get(D)!.style.top = `${window.innerHeight - 100}px`

        this.map.get(W)!.style.left = `300px`
        this.map.get(A)!.style.left = `200px`
        this.map.get(S)!.style.left = `300px`
        this.map.get(D)!.style.left = `400px`
    }

    public down(key: string) {
        const lower = key.toLowerCase()
        if (this.map.has(lower)) {
            this.map.get(lower)!.style.color = 'red'
        }
    }

    public up(key: string) {
        const lower = key.toLowerCase()
        if (this.map.has(lower)) {
            this.map.get(lower)!.style.color = 'blue'
        }
    }
}
