const { Command } = require("commander");
const program = new Command();

let transactions = [];
//SOFTWARE DESCRIPTION
program.name("ledger-cli").description("CLI ledger to manage your finances by Jesus Murguia").version("0.0.1");

//REGISTER COMMAND
program
	.command("register")
	.alias("reg")
	.description("Displays all the postings occurring in a single account.")
	.action(() => handleRegister(program.args, program.opts()));

//BALANCE COMMAND
program
	.command("balance")
	.alias("bal")
	.description("Displays the balances of every account in your journal.")
	.action(() => handleBalance(program.args, program.opts()));

//PRINT COMMAND
program
	.command("print")
	.alias("p")
	.description("Displays all the transactions in an alternative format.")
	.action(() => handlePrint(program.args, program.opts()));

//OPTIONS
program
	.option("--price-db <string>", "The file for the prices database", "prices_db")
	.option("--file, -f <string...>", "The file(s) for the ledger accounts", ["index.ledger"])
	.option("--sort, -S <string>", "Sort a report by date");

program.parse(process.argv);

function handleRegister(accounts, options) {
	let logs = getTransactions(options.F);
	let totals = new Map();
	let rows = [];
	for (let i = 0; i < logs.length; i++) {
		let { date, title, entries } = logs[i];
		let { account, amount, commodity } = entries[0];
		//set the total sum of this account by adding this entries amount
		let newAmount = updateAmount(amount, totals.get(account) || "0", commodity, "+");
		totals.set(account, newAmount);
		//push the row into the array to be printed later
		rows.push([`${date} ${title}     `, account, amount, newAmount]);
		for (let j = 1; j < entries.length; j++) {
			let { account, amount, commodity } = entries[j];
			if (amount !== "EMPTY") {
				//set the total sum of this account by adding this entries amount
				let newAmount = updateAmount(amount, totals.get(account) || "0", commodity, "+");
				totals.set(account, newAmount);
				//push the row into the array to be printed later
				rows.push(["", account, amount, newAmount]);
			} else {
				//get the last values
				let last = entries[j - 1];
				//set the amount to be the total of the account but negative
				amount = updateAmount(
					totals.get(last.account) || formatAmount("0", last.amount, last.commodity),
					"-1",
					last.commodity,
					"*"
				);
				//set the total sum of this account by adding this entries amount
				let newAmount = updateAmount(
					amount,
					totals.get(last.account) || formatAmount("0", last.amount, last.commodity),
					last.commodity,
					"+"
				);
				totals.set(last.account, newAmount);
				//push the row into the array to be printed later
				rows.push(["", account, amount, newAmount]);
			}
			const iterator = totals[Symbol.iterator]();
			iterator.next();
			for (const value of iterator) {
				if (Number(value[1].match(/[-\d\., ]/g).join("")) !== 0) rows.push([" ", " ", " ", value[1]]);
			}
		}
	}
	var table = require("text-table");
	var t = table(rows, { align: ["l", "l", "r", "r"] });
	console.log(`\n${t}\n`);
}

//To find the balances of all of your accounts
function handleBalance(accounts, options) {
	let logs = getTransactions(options.F);

	//get all the transactions from the logs
	// let balance = [];
	// let transactions = logs.map((log) => ({ accounts: log.accounts, amounts: log.amounts }));

	// console.log(transactions);
}

function printBalance(logs) {
	logs.forEach((log) => {
		for (let i = 0; i < log.accounts.length; i++) {
			console.log(`${log.amounts[i]} ${padding} ${log.accounts[i]}`);
		}
	});
	console.log("---------------");
}

function handlePrint(accounts, options) {
	console.log(getTransactions(options.F));
}

//This function reads everyfile line by line, saves each transactions into an object and puts them into an array
function getTransactions(files) {
	const lineByLine = require("n-readlines");
	//loop through every file declared in the command line options
	for (let i = 0; i < files.length; i++) {
		let transaction = transactionFactory();
		const liner = new lineByLine(files[i]);

		let line;

		while ((line = liner.next())) {
			//if this line says it includes another file it will loop through that file and come back to the next line
			let currentLine = line.toString("ascii");

			if (currentLine.includes("!include")) getTransactions([currentLine.split(" ")[1].replaceAll("\r", "")]);
			else {
				//trim the line to avoid empty spaces
				//this will also help identify new lines
				//to know when to end the current transaction
				currentLine = currentLine.trim();
				//if the next line is a comment ignore it
				if (currentLine[0] === ";") continue;

				//if theres an empty line we add the transaction to the list
				//and reset the transaction object
				if (currentLine.length === 0) {
					transactions.push(transaction);
					transaction = transactionFactory();
					continue;
				}

				//if the next line has a date in it
				//we save both the date and the title
				if (hasDate(currentLine)) {
					if (transaction.date) {
						transactions.push(transaction);
						transaction = transactionFactory();
					}
					const [date, title] = currentLine.split(/ (.*)/s);
					transaction.date = date;
					transaction.title = title;
				} else {
					//if it doesnt have a date, it has the account - amount pair
					//split the line by tabs and remove the empty ones
					let [account, amount] = currentLine
						.trim()
						.split("\t")
						.filter((n) => n);
					let commodity = "";
					if (amount) {
						commodity = amount.replace(/[-\d\., ]/g, "").trim();
						transaction.entries.push({ amount, commodity, account: account.trim() });
					} else {
						//if the amount is empty i gotta calculate the number myself
						transaction.entries.push({
							amount: "EMPTY",
							commodity: "EMPTY",
							account: account.trim(),
						});
					}
				}
			}
		}
		if (transaction.date) {
			transactions.push(transaction);
			transaction = transactionFactory();
		}
	}
	return transactions;
}

function hasDate(line) {
	const dateType = /(\d{4})([\/-])(\d{1,2})\2(\d{1,2})/;
	return dateType.test(line);
}
//return an empty transaction object
function transactionFactory() {
	let transaction = {
		date: "",
		title: "",
		entries: [],
	};
	return transaction;
}

function updateAmount(amount1, amount2, commodity, operation) {
	let num1 = Number(amount1.match(/[-\d\., ]/g).join(""));
	let num2 = Number(amount2.match(/[-\d\., ]/g).join(""));

	let res;
	if (operation === "+") res = Math.round((num1 + num2 + Number.EPSILON) * 100) / 100;
	if (operation === "*") res = Math.round((num1 * num2 + Number.EPSILON) * 100) / 100;

	return formatAmount(res, amount1, commodity);
}

function formatAmount(amount, format, commodity) {
	if (format.endsWith(commodity)) {
		return `${amount} ${commodity}`;
	} else if (amount < 0) {
		let arr = String(amount).split("");
		arr.splice(1, 0, commodity);
		return arr.join("");
	}
	return commodity + amount;
}
