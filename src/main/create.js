const { towns, Path } = require("../config")

async function create(amount) {
    try {
        towns.warn(`Generating ${amount} private and public client`)

        let created = 0
        while (created < amount) {
            await Path.createClient()
            created++
        }

        towns.success(`Successfully generating ${amount} private and public client`)
    } catch (error) {
        towns.error(`Unexpected error occured: ${error}`)
    }
}

create(1) //change amount here