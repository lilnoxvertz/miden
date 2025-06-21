const chalk = require("chalk")
const fs = require("fs")
const path = require("path")
const { exec } = require("child_process")
const util = require("util")
const moment = require("moment-timezone")
const toml = require("@iarna/toml")
const { sha3_256 } = require("js-sha3")

const execCommand = util.promisify(exec)

const timestamp = () => {
    return chalk.rgb(123, 164, 253)(`[${moment().tz("Asia/jakarta").format("HH:mm:ss")}]`)
}

const delay = (ms) => {
    return new Promise(r => setTimeout(r, ms))
}

class towns {
    static success(msg) {
        console.log(timestamp(), chalk.greenBright(msg))
    }

    static error(msg) {
        console.log(timestamp(), chalk.redBright(msg))
    }

    static pending(msg) {
        console.log(timestamp(), chalk.yellowBright(msg))
    }

    static warn(msg) {
        console.log(timestamp(), chalk.rgb(253, 155, 70)(msg))
    }
}

async function executeCommand(command, filepath) {
    try {
        const clientPath = path.resolve(__dirname, filepath)
        const { stdout, stderr } = await execCommand(command, { cwd: clientPath })

        if (stderr) {
            towns.error(`Failed executing [${command}] command: ${stderr}`)
            return {
                status: false,
                error: stderr
            }
        }

        return {
            status: true,
            result: stdout
        }
    } catch (error) {
        towns.error(`Unexpected error: ${error}`)
        return {
            status: false,
            error: error
        }
    }
}

const truncateAddress = (address) => {
    const start = address.slice(0, 5)
    const end = address.slice(27, 32)

    return `${start}....${end}`
}

const truncateNotes = (notes) => {
    const start = notes.slice(0, 6)
    const end = notes.slice(61, 66)

    return `${start}....${end}`
}

class Path {
    static in(fileName) {
        return `cd ${fileName}`
    }

    static out() {
        return "cd ../"
    }

    static createPath(path) {
        try {
            fs.mkdirSync(path, { recursive: true })
        } catch (error) {
            towns.error(`Failed creating [${path}] path: ${error}`)
        }
    }

    static async createClient() {
        let publicClientCount
        let privateClientCount

        const privatePath = "./clients/private"
        const publicPath = "./clients/public"

        try {
            this.createPath(privatePath)
            this.createPath(publicPath)

            const publicFolder = fs.readdirSync(publicPath, "utf-8")
            const privateFolder = fs.readdirSync(privatePath, "utf-8")

            const publicClientFolder = publicFolder.filter(folder => folder.split("_")[0].startsWith("client"))
            const privateClientFolder = privateFolder.filter(folder => folder.split("_")[0].startsWith("client"))

            publicClientCount = publicClientFolder.length
            privateClientCount = privateClientFolder.length

            const privateClientId = privateClientCount + 1
            const publicClientId = publicClientCount + 1

            towns.warn(`Creating a new private and public client`)

            const privateclientPath = path.join(privatePath, `client_${privateClientId}`)
            const publicClientPath = path.join(publicPath, `client_${publicClientId}`)

            this.createPath(privateclientPath)
            this.createPath(publicClientPath)

            towns.success(`Successfully creating private client #${privateClientId} and public client #${publicClientId}!`)
            towns.warn(`Initiating and creating a new wallet for bot client..`)

            await Miden.init(publicClientId, privateClientId)
        } catch (error) {
            towns.error(`Failed creating client: ${error}`)
        }

        return
    }
}

class Miden {
    static async faucet(accountId, path) {
        const truncatedAddress = truncateAddress(accountId)

        const header = {
            'Accept': '*/*',
            'Accept-Language': 'en-US,enq=0.9',
            'Cache-Control': 'no-cache',
            'Dnt': '1',
            'Pragma': 'no-cache',
            'Sec-Ch-Ua': '"Microsoft Edge"v="137", "Chromium"v="137", "Not(A:Brand"v="24"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0 Win64 x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 Edg/137.0.0.0'
        }

        const getPowChallenge = async () => {
            towns.pending(`${truncatedAddress} is trying to get the pow challenge..`)
            const url = "https://faucet.testnet.miden.io/pow"

            let pow = false
            let attempt = 0
            const maxAttempt = 3

            while (!pow && attempt < maxAttempt) {
                try {
                    const response = await fetch(url, {
                        method: "GET",
                        headers: header
                    })

                    if (!response.ok) {
                        towns.error(`${truncatedAddress} Failed getting pow challenge. retrying (${attempt}/${maxAttempt})`)
                        await new Promise(r => setTimeout(r, 15000))
                        continue
                    }

                    const result = await response.json()
                    const seed = result.seed
                    const difficulty = result.difficulty
                    const server_signature = result.server_signature
                    const timestamp = result.timestamp

                    pow = true
                    towns.success(`${truncatedAddress} successfully retrieved pow challenge data`)

                    return {
                        seed: seed,
                        difficulty: difficulty,
                        server_signature: server_signature,
                        timestamp: timestamp
                    }
                } catch (error) {
                    towns.error(`${truncatedAddress} Failed getting pow challenge: ${error}`)
                }

                attempt++
            }

            return
        }

        const getPowSolution = async (seed, difficulty) => {
            if (typeof sha3_256 === 'undefined') {
                console.error("SHA3 library not properly loaded. SHA3 object:", sha3_256)
                throw new Error('SHA3 library not properly loaded. Please refresh the page.')
            }

            const requiredZeros = parseInt(difficulty)
            const requiredPattern = '0'.repeat(requiredZeros)

            let nonce = 0
            let validNonceFound = false

            while (!validNonceFound) {
                nonce = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)

                try {
                    let hash = sha3_256.create()
                    hash.update(seed)
                    hash.update(nonce.toString())
                    let digest = hash.hex().toString()

                    if (digest.startsWith(requiredPattern)) {
                        validNonceFound = true
                        return nonce
                    }
                } catch (error) {
                    towns.error(`Failed computing hash: ${error}`)
                }

                if (nonce % 1000 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0))
                }
            }
        }

        let faucet = false
        let attempt = 0
        const maxAttempt = 3

        while (!faucet && attempt < maxAttempt) {
            try {
                const powChallengeData = await getPowChallenge()
                const powSolution = await getPowSolution(powChallengeData.seed, powChallengeData.difficulty)

                const url = `https://faucet.testnet.miden.io/get_tokens?account_id=${accountId}&is_private_note=false&asset_amount=1000&pow_seed=${powChallengeData.seed}&pow_solution=${powSolution}&pow_difficulty=${powChallengeData.difficulty}&server_signature=${powChallengeData.server_signature}&server_timestamp=${powChallengeData.timestamp}`

                const response = await fetch(url, {
                    method: "GET",
                    headers: header
                })

                if (!response.ok) {
                    towns.error(`${truncatedAddress} Failed getting faucet. retrying (${attempt}/${maxAttempt})`)
                    await new Promise(r => setTimeout(r, 15000))
                    continue
                }

                const result = await response.text()
                const trimmed = result.trim().split("\n")

                for (let i = 0; i < trimmed.length; i++) {
                    if (trimmed[i] === "") {
                        trimmed.splice(i, 1)
                    }
                }

                const lastIndex = trimmed.length - 1
                const sliced = trimmed[lastIndex].slice(5)
                const parsedResult = JSON.parse(sliced)
                const note = parsedResult.note_id
                faucet = true

                towns.warn(`${truncatedAddress} Successfully received notes!`)
                await delay(10000)
                const sync = await this.sync(accountId, path)

                if (!sync) {
                    return
                }

                await delay(10000)
                const consume = await this.consume(accountId, note, path)

                if (!consume) {
                    return
                }

                towns.success(`${truncatedAddress} Successfully claiming faucet`)
                return
            } catch (error) {
                towns.error(`Failed getting faucet for client #${truncatedAddress}: ${error}`)
            }

            attempt++
        }

        return
    }

    static async accountList() {
        try {
            towns.pending("Loading public and private account..")
            const publicAccounts = fs.readFileSync("publicAccountId.txt", "utf-8")
                .split("\n")
                .filter(address => address.trim())

            const privateAccounts = fs.readFileSync("privateAccountId.txt", "utf-8")
                .split("\n")
                .filter(address => address.trim())

            towns.success("Successfully loaded public and private account")

            return {
                public: publicAccounts,
                private: privateAccounts
            }
        } catch (error) {
            towns.error(`Failed loading account list: ${error}`)
        }
    }

    static async getAccountBalance(accountId, path) {
        try {
            const faucetAddress = "mtst1qzm09dk5guhtjgqqqzzzp8f2fvkz9vtx"
            const command = `miden account --show ${accountId}`
            const balance = await executeCommand(command, path)

            if (!balance.status) {
                towns.error(`${accountId} Failed retrieving balance`)
                return
            }

            const regex = new RegExp(`Fungible Asset\\s*┆\\s*${faucetAddress}\\s*┆\\s*(-?\\d+)`)
            const match = balance.result.match(regex)

            if (match && match[1]) {
                const amount = parseInt(match[1])
                return amount
            }

            return
        } catch (error) {
            towns.error(`${accountId} Unexpected error: ${error}`)
            return
        }
    }

    static async getNotesList(accountId, path) {
        try {
            await this.sync(accountId, path)
            const command = "miden notes -l"
            const notes = await executeCommand(command, path)

            if (!notes.status) {
                towns.error(`${accountId} Failed getting notes list: ${notes.error}`)
                return
            }

            const regex = /^\s*(0x[a-f0-9]{64})\s+Committed/gm
            const matchCommittedNotes = notes.result.matchAll(regex)
            const noteList = Array.from(matchCommittedNotes, note => note[1])

            return noteList
        } catch (error) {
            towns.error(`${accountId} Unexpected error: ${error}`)
            return
        }
    }

    static async sync(accountId, path) {
        const truncatedAddress = truncateAddress(accountId)
        towns.pending(`${truncatedAddress} Trying to sync..`)
        try {
            const command = "miden sync"
            const sync = await executeCommand(command, path)

            if (!sync.status) {
                towns.error(`Failed syncing client #${truncatedAddress}: ${sync.error}`)
                return false
            }

            towns.success(`${truncatedAddress} Successfully synced!`)
            return true
        } catch (error) {
            towns.error(`Unexpected error while syncing client #${truncatedAddress}: ${error}`)
            return false
        }
    }

    static async consume(accountId, note, path) {
        const truncatedAddress = truncateAddress(accountId)
        const truncatedNote = truncateNotes(note)

        towns.pending(`${truncatedAddress} Trying to consume note: ${truncatedNote}`)
        try {
            const sync = await this.sync(accountId, path)

            if (!sync) {
                return true
            }

            const command = `miden consume-notes --account ${accountId} ${note} --force`
            const consume = await executeCommand(command, path)

            if (!consume.status) {
                towns.error(`${truncatedAddress} Failed consuming note: ${consume.error}`)
                return false
            }

            towns.success(`${truncatedAddress} Successfully consumed note!`)

            await delay(15000)
            const lastSync = await this.sync(accountId, path)

            if (!lastSync) {
                return true
            }

            return true
        } catch (error) {
            towns.error(`${truncatedAddress} Unexpected error: ${error}`)
            return false
        }
    }

    static async send(accountId, target, amount, faucetAddress, type, path) {
        const truncatedAddress = truncateAddress(accountId)
        const truncatedTarget = truncateAddress(target)

        towns.pending(`${truncatedAddress} is trying to ${type} send ${amount} token to ${truncatedTarget}`)

        try {
            const command = `miden send --sender ${accountId} --target ${target} --asset ${amount}::${faucetAddress} --note-type ${type} --force`
            const consume = await executeCommand(command, path)

            if (!consume.status) {
                towns.error(`${truncatedAddress} Failed sending token to ${truncatedTarget}: ${consume.error}`)
                return
            }

            towns.success(`${truncatedAddress} Successfully sending token to ${truncatedTarget}`)
            return
        } catch (error) {
            towns.error(`${truncatedAddress} Unexpected error: ${error}`)
            return
        }
    }

    static async createMutableWallet(privateClientId) {
        try {
            const privateClientPath = `../clients/private/client_${privateClientId}`
            const command = "miden new-wallet --mutable"
            const createPrivateWallet = await executeCommand(command, privateClientPath)

            if (!createPrivateWallet.status) {
                towns.error(`Failed creating a new private client wallet: ${createPrivateWallet.error}`)
                return
            }

            towns.success(`Successfully creating a new private client wallet`)
            await delay(15000)

            const dataPath = path.resolve(__dirname, `${privateClientPath}/miden-client.toml`)
            const data = fs.readFileSync(dataPath, "utf-8")
            const parsedData = toml.parse(data)

            towns.warn(`Saving private client #${privateClientId} account id..`)
            fs.appendFileSync("privateAccountId.txt", `${parsedData.default_account_id}\n`, "utf-8")

            towns.success(`Successfully saving #${privateClientId} account id!`)
            return
        } catch (error) {
            towns.error(`Failed creating a private mutable wallet: ${error}`)
            return
        }
    }

    static async createMutablePublicWallet(publicClientId) {
        try {
            const publicClientPath = `../clients/public/client_${publicClientId}`
            const command = "miden new-wallet --mutable -s public"
            const createPublicWallet = await executeCommand(command, publicClientPath)

            if (!createPublicWallet.status) {
                towns.error(`Failed creating a new private client wallet: ${createPrivateWallet.error}`)
                return
            }

            towns.success(`Successfully creating a new public client wallet`)
            await delay(15000)
            const dataPath = path.resolve(__dirname, `${publicClientPath}/miden-client.toml`)
            const data = fs.readFileSync(dataPath, "utf-8")
            const parsedData = toml.parse(data)

            towns.warn(`Saving client public #${publicClientId} account id..`)
            fs.appendFileSync("publicAccountId.txt", `${parsedData.default_account_id}\n`, "utf-8")

            towns.success(`Successfully saving #${publicClientId} account id!`)
            return
        } catch (error) {
            towns.error(`Failed creating a public mutable wallet: ${error}`)
            return
        }
    }

    static async init(privateClientId, publicClientId) {
        try {
            const privateClientPath = `../clients/private/client_${privateClientId}`
            const publicClientPath = `../clients/public/client_${publicClientId}`

            const command = "miden init --network testnet"
            const privateInit = await executeCommand(command, privateClientPath)
            const publicInit = await executeCommand(command, publicClientPath)

            if (!privateInit.status && !publicInit.status) {
                towns.error(`Failed initializing private client: ${privateInit.error}`)
                towns.error(`Failed initializing public client: ${publicInit.error}`)
            } else if (!privateInit.status || !publicInit.status) {
                const clientError = !privateInit.status ? privateInit.error : publicInit.error
                const clientName = !privateInit.status ? "private" : "public"
                towns.error(`Failed initializing ${clientName} client: ${clientError}`)
            }

            towns.success(`Successfully intializing both account. creating a new address..`)
            await delay(15000)

            const privateWallet = await this.createMutableWallet(privateClientId)
            const publicWallet = await this.createMutablePublicWallet(publicClientId)

            if (!privateWallet && !publicWallet) {
                return
            } else if (!privateWallet || !publicWallet) {
                return
            }

            towns.success(`Successfully creating a new address on both folders`)
            return
        } catch (error) {
            towns.error(`Failed initilizing the client: ${error}`)
            return
        }
    }
}

module.exports = { Miden, Path, towns, truncateAddress }