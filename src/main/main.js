const fs = require("fs")
const { towns, Miden, truncateAddress } = require("../config")

async function startTask(acountId, path, recipients) {
    const truncatedAddress = truncateAddress(acountId)
    const tasks = [
        "faucet",
        "send",
        "consume"
    ]

    let cycle = 0
    const maxCycle = 5

    while (cycle < maxCycle) {
        cycle++
        const randomTask = tasks[Math.floor(Math.random() * tasks.length)]
        towns.warn(`${truncatedAddress} is working on ${randomTask} task`)
        try {
            switch (randomTask) {
                case "faucet":
                    await Miden.faucet(acountId, path)
                    break

                case "send":
                    const types = [
                        "public",
                        "private"
                    ]

                    const target = recipients[Math.floor(Math.random() * recipients.length)]
                    const amount = Math.floor(Math.random() * (50 + 1 + 1)) + 1
                    const faucetAddress = "mtst1qzm09dk5guhtjgqqqzzzp8f2fvkz9vtx"
                    const type = types[Math.floor(Math.random() * types.length)]

                    const balance = await Miden.getAccountBalance(acountId, path)

                    if (balance < parseInt(amount)) {
                        towns.warn(`${acountId} Balance is smaller than the amount to send. skipping..`)
                        break
                    }

                    await Miden.send(acountId, target, amount, faucetAddress, type, path)
                    break

                case "consume":
                    const notes = await Miden.getNotesList(acountId, path)
                    const randomNotes = notes[Math.floor(Math.random() * notes.length)]

                    if (randomNotes === undefined || randomNotes === null) {
                        towns.warn(`${truncatedAddress} Doesn't have any notes to consume. skipping..`)
                        break
                    }
                    await Miden.consume(acountId, randomNotes, path)
                    break
            }
        } catch (error) {
            towns.error(`${truncatedAddress} Failed unexpected error: ${error}`)
        }

        towns.pending(`${truncatedAddress} Waiting before creating transaction again.`)
        const delay = Math.floor(Math.random() * (20000 + 8000 + 1)) + 8000
        await new Promise(r => setTimeout(r, delay))
    }
}

async function main() {
    console.clear()
    const privatePath = "./clients/private"
    const publicPath = "./clients/public"

    const privateFolder = fs.readdirSync(privatePath, "utf-8")
    const publicFolder = fs.readdirSync(publicPath, "utf-8")

    const privateFiles = privateFolder.filter(folder => folder.trim().split("_")[0].startsWith("client"))
    const publicFiles = publicFolder.filter(folder => folder.trim().split("_")[0].startsWith("client"))

    const accountList = await Miden.accountList()
    const privateAccounts = accountList.private
    const publicAccounts = accountList.public

    const privatePromises = privateFiles.map((value, index) => {
        const currentClient = index + 1
        const path = `../clients/private/client_${currentClient}`
        const recipients = [...privateAccounts, ...publicAccounts]

        if (recipients[index] === privateAccounts[index]) {
            recipients.splice(index, 1)
        }

        startTask(privateAccounts[index], path, recipients)
    })

    const publicPromises = publicFiles.map((value, index) => {
        const currentClient = index + 1
        const path = `../clients/public/client_${currentClient}`
        const recipients = [...privateAccounts, ...publicAccounts]

        if (recipients[index] === publicAccounts[index]) {
            recipients.splice(index, 1)
        }

        startTask(publicAccounts[index], path, recipients)
    })

    const promises = [...privatePromises, ...publicPromises]
    await Promise.all(promises)
}

main().then(towns.success(`All process done!`))