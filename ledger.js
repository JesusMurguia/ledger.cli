const { Command, Option } = require("commander");
const program = new Command();

//declare the array where all the transactions are going to be stored
let transactions = [];
//declare the map where all the commodities are going to be stored
let prices = new Map();

//SOFTWARE DESCRIPTION
program.name("ledger-cli").description("CLI ledger to manage your finances by Jesus Murguia");

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
	.addOption(new Option("--price-db <string>", "The file for the prices database").default("prices_db"))
	.addOption(new Option("--file, -f <string>", "The file(s) for the ledger accounts").default("index.ledger"))
	.addOption(new Option("--sort, -S <string>", "Sort a report by date").choices(["d", "date", "amount", "a"]))
	.addOption(new Option("--begin, -b <string>", "Limit the report by the starting date"))
	.addOption(new Option("--end, -e <string>", "Limit the report by the ending date"))
	.addOption(new Option("--subtotal", "Report register as a single subtotal"))
	.addOption(new Option("--market, -V", "Report values as their market value9"));

program.parse(process.argv);

//this function show every transaction and a running total
function handleRegister(accounts, options) {
	//get the transactions from the --file
	let logs = getTransactions(options.F);
	//if there are options for --begin and --end limit the logs array
	if (options.B || options.E) logs = limitLogs(options.B, options.E, logs);
	//if if needs to sort the array by date
	if (options.S === "d" || options.S === "date") logs = sortByDate(logs);
	let totals = new Map(); //this will store the total of each currency
	let sum = "0"; //this will be the running total of each transaction
	let rows = []; //this represents the rows of the table to be printed
	//loop thorough each transaction
	for (let i = 0; i < logs.length; i++) {
		let { date, title, entries } = logs[i];
		let { account, amount, commodity } = entries[0];
		let first = true; //we need to know if this is the first entry of the transaction to print the title or not
		//If the user asks for the --market value reset the commodity to the default one in the prices_db file
		if (program.opts().V) commodity = prices.get("DEFAULT");
		//set the total sum of this commodity
		let newAmount = updateAmount(getValue(amount), totals.get(commodity) || "0", commodity, "+");
		if (checkRegex(account)) totals.set(commodity, newAmount);
		sum = updateAmount(getValue(amount), sum || "0", commodity, "+");
		//push the row into the array to be printed later
		if (checkRegex(account)) {
			rows.push([first ? `${date} ${title}     ` : "", account, getValue(amount), newAmount]);
			first = false;
		}
		//print the rest of the totals
		if (checkRegex(account)) {
			const iterator = totals[Symbol.iterator]();
			for (const value of iterator) {
				if (value[0] !== commodity && Number(value[1].match(/[-\d\., ]/g).join("")) !== 0)
					rows.push([" ", " ", "", getValue(value[1])]);
			}
		}
		//loop through each entry on the transaction
		for (let j = 1; j < entries.length; j++) {
			let { account, amount, commodity } = entries[j];
			if (program.opts().V) commodity = prices.get("DEFAULT");
			//if the transaction amount is empty we need to calculate the amount, otherwise just add it to the totals
			if (amount !== "EMPTY") {
				//set the total sum of this commodity
				let newAmount = updateAmount(getValue(amount), totals.get(commodity) || "0", commodity, "+");
				if (checkRegex(account)) totals.set(commodity, newAmount);
				sum = updateAmount(getValue(amount), sum || "0", commodity, "+");
				//push the row into the array to be printed later
				if (checkRegex(account)) {
					rows.push([first ? `${date} ${title}     ` : "", account, getValue(amount), newAmount]);
					first = false;
				}
				//print the rest of the totals
				if (checkRegex(account)) {
					const iterator = totals[Symbol.iterator]();
					for (const value of iterator) {
						if (value[0] !== commodity && Number(value[1].match(/[-\d\., ]/g).join("")) !== 0)
							rows.push([" ", " ", "", getValue(value[1])]);
					}
				}
			} else {
				if (!checkRegex(account)) continue;
				//get the last values
				let last = entries[j - 1];
				if (program.opts().V) last.commodity = prices.get("DEFAULT");
				//set the total sum of this account by adding this entries amount
				sum = updateAmount(sum || "0", "-1", last.commodity, "*");
				let newAmount = updateAmount(
					sum,
					totals.get(last.commodity) || formatAmount("0", last.amount, last.commodity),
					last.commodity,
					"+"
				);
				totals.set(last.commodity, newAmount);
				//push the row into the array to be printed later
				rows.push([first ? `${date} ${title}     ` : "", account, getValue(sum), getValue(newAmount)]);
				first = false;
				//print the rest of the totals
				const iterator = totals[Symbol.iterator]();
				for (const value of iterator) {
					if (value[0] !== last.commodity && Number(value[1].match(/[-\d\., ]/g).join("")) !== 0)
						rows.push([" ", " ", "", getValue(value[1])]);
				}
			}
		}
		sum = 0;
		first = true;
	}
	//if the user asks for a --subtotal only print the totals instead of the transactions
	if (program.opts().subtotal) {
		rows = [];
		const iterator = totals[Symbol.iterator]();
		for (const value of iterator) {
			rows.push([" ", " ", value[0], getValue(value[1])]);
		}
	}
	//convert the rows array into a readable table
	var table = require("text-table");
	var t = table(rows, { align: ["l", "l", "r", "r"] });
	console.log(t);
}

//To find the balances of all of your accounts
function handleBalance(accounts, options) {
	let logs = getTransactions(options.F);
	let totals = new Map(); //save the totals of each account
	let sum = "0";
	let rows = [];
	//loop through each transaction
	for (let i = 0; i < logs.length; i++) {
		//loop through each entry
		for (let j = 0; j < logs[i].entries.length; j++) {
			let { account, amount, commodity } = logs[i].entries[j];
			//if the transaction amount is empty we need to calculate the amount, otherwise just add it to the totals
			if (amount !== "EMPTY") {
				//set the total sum of this commodity
				let newAmount = updateAmount(amount, totals.get(account) || "0", commodity, "+");
				totals.set(account, newAmount);

				sum = updateAmount(amount, sum.toString(), commodity, "+");
			} else {
				sum = updateAmount(sum.toString(), "-1", logs[i].entries[j - 1].commodity, "*");
				totals.set(account, sum);
				sum = "0";
			}
		}
		sum = "0";
	}
	//if the user asks for --sort by amount
	if (options.S === "amount") totals = sortByAmount(totals);
	//check each total to send to the rows array the ones that fit the regex
	const iterator = totals[Symbol.iterator]();
	for (const value of iterator) {
		if (checkRegex(value[0])) rows.push([getValue(value[1]), value[0]]);
		else totals.delete(value[0]);
	}
	rows.push(["-----------", ""]);
	//add all the totals with the same commodities together
	const iterator2 = sumCommodities(totals)[Symbol.iterator]();
	for (const value of iterator2) {
		rows.push([getValue(value[1]), ""]);
	}
	//convert the rows array into a readable table
	var table = require("text-table");
	var t = table(rows, { align: ["r", "l"] });
	console.log(t);
}

//this function prints the ledger files
function handlePrint(accounts, options) {
	let logs = getTransactions(options.F);
	logs = filterLogs(logs); //filters the transactions by the regex
	if (options.S === "d" || options.S === "date") logs = sortByDate(logs);
	let rows = [];
	//loop through each transaction
	for (let i = 0; i < logs.length; i++) {
		let { date, title, entries } = logs[i];
		//print the date and title
		rows.push([`${date} ${title}`]);
		//loop through each entry
		for (let j = 0; j < entries.length; j++) {
			let { account, amount } = entries[j];
			//print the account and amount
			rows.push([`	${account}	`, `${amount === "EMPTY" ? "" : getValue(amount)}`]);
		}
		rows.push([""]);
	}
	//convert the rows array into a readable table
	var table = require("text-table");
	var t = table(rows, { align: ["l", "l"] });
	console.log(t);
}

//This function reads the --file line by line, saves each transactions into an object and puts them into an array
function getTransactions(file) {
	getPrices(); //populates the prices map by reading the prices_db file
	const lineByLine = require("n-readlines");
	let transaction = transactionFactory(); //get a new transaction object
	const liner = new lineByLine(file);

	let line;

	//read the file line by line
	while ((line = liner.next())) {
		//if this line says it includes another file it will loop through that file and come back to the next line
		let currentLine = line.toString("ascii");
		if (currentLine.includes("!include")) getTransactions(currentLine.split(" ")[1].replaceAll("\r", ""));
		else {
			//trim the line to avoid empty spaces
			//this will also help identify new lines
			//to know when to end the current transaction
			currentLine = currentLine.trim();
			//if the next line is a comment ignore it
			if (/;|#|%|"|[|]|[*]/.test(currentLine[0])) continue;

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
					.split(/[\t]|[ ]{2,}/)
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
	//if at the end of the file there is a file left, push it into the array
	if (transaction.date) {
		transactions.push(transaction);
		transaction = transactionFactory();
	}
	return transactions;
}

//reads the prices_db file and saves every commodity into the prices map
function getPrices() {
	const lineByLine = require("n-readlines");
	const liner = new lineByLine(program.opts().priceDb);
	let line;
	while ((line = liner.next())) {
		let arr = line.toString().trim().split(" ");
		if (line.toString().trim().startsWith("P")) {
			prices.set(arr[arr.length - 2], arr[arr.length - 1]);
		}
		if (line.toString().trim().startsWith("N")) {
			prices.set(arr[arr.length - 1], "1");
			prices.set("DEFAULT", arr[arr.length - 1]);
		}
	}
}

//checks if a line contains a date
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

//returns the amount without the commodity example: $100.00 => 100.00
function getNumber(str) {
	return Number(str.match(/[-\d\., ]/g).join(""));
}

//adds or multiplies two ammounts and can change the commodity
function updateAmount(amount1, amount2, commodity, operation) {
	let num1 = getNumber(amount1);
	let num2 = getNumber(amount2);

	let res;
	if (operation === "+") res = Math.round((num1 + num2 + Number.EPSILON) * 100) / 100;
	if (operation === "*") res = Math.round((num1 * num2 + Number.EPSILON) * 100) / 100;

	return formatAmount(res, amount1, commodity);
}

//adds a commodity to a number for example 100.00 => $100.00
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

//sorts transactions by date
function sortByDate(logs) {
	logs.sort(function (a, b) {
		return new Date(a.date) - new Date(b.date);
	});
	return logs;
}

//checks if a string matches the regex in the command line options
function checkRegex(str) {
	let arr = program.args;
	if (arr.length < 2) return true;
	let regex = new RegExp(arr.slice(1).join("|"), "g");
	let matches = str.match(regex) || [];
	return matches.length > 0;
}

//adds up all the entries in the totals map that are of the same commodity
function sumCommodities(totals) {
	let commodities = new Map();
	const iterator = totals[Symbol.iterator]();
	for (const value of iterator) {
		let comodity = program.opts().V ? prices.get("DEFAULT") : value[1].replace(/[-\d\., ]/g, "").trim();
		let newAmount = value[1];
		if (commodities.get(comodity)) {
			newAmount = updateAmount(
				getValue(value[1]),
				commodities.get(program.opts().V ? prices.get("DEFAULT") : comodity),
				program.opts().V ? prices.get("DEFAULT") : comodity,
				"+"
			);
		}
		commodities.set(program.opts().V ? prices.get("DEFAULT") : comodity, getValue(newAmount));
	}
	return commodities;
}

//removes all the entries of every transaction that doesnt fit the regex in the command line options
function filterLogs(logs) {
	let transactions = logs;
	let arr = program.args;
	if (arr.length < 2) return transactions;
	let regex = new RegExp(arr.slice(1).join("|"), "g");
	for (let i = 0; i < transactions.length; i++) {
		for (let j = 0; j < transactions[i].entries.length; j++) {
			let matches = transactions[i].entries[j].account.match(regex) || [];
			if (matches.length === 0) {
				transactions[i].entries.splice(j, 1);
				j--;
			}
		}
		if (transactions[i].entries.length === 0) transactions.splice(i--, 1);
	}
	return transactions;
}

//converts an amount to the default commodity specified in the prices_db file
function convertCommodity(amount) {
	let commodity = amount.replace(/[-\d\., ]/g, "").trim();
	if (prices.get(commodity)) return updateAmount(prices.get(commodity), amount, prices.get("DEFAULT"), "*");
	return;
}

//returns the market value if the users asks for it otherwise it just returns the str
function getValue(str) {
	if (!program.opts().V) return str;
	return convertCommodity(str);
}

//sorts the totals map by amount
function sortByAmount(totals) {
	let sorted = new Map(
		[...totals.entries()].sort((a, b) =>
			getNumber(convertCommodity(b[1])) >= getNumber(convertCommodity(a[1])) ? 1 : -1
		)
	);
	return sorted;
}

//removes every transaction that doesnt fit in with the date limitations specified in the command line options
function limitLogs(begin, end, logs) {
	logs = logs.filter((l) => {
		if (begin) {
			return new Date(l.date).getTime() > new Date(begin).getTime();
		} else if (end) {
			return new Date(l.date).getTime() < new Date(end).getTime();
		}
		return true;
	});
	return logs;
}
