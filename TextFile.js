const fs = require("fs");
const memories = {};
const EventEmitter = require("events");

class TextFile extends EventEmitter
{
	/** @type {boolean} */
	static #allowConstruct = false;

	/** @type {TextFile} */
	static getTextFile(filePath)
	{
		if(memories[filePath]) return memories[filePath];

		this.#allowConstruct = true;
		const m = new TextFile(filePath);
		this.#allowConstruct = false;
		memories[filePath] = m;
		return m;
	}
	/**
	 * @event TextFile.complete
	 * @param {TextFile} textFile
	 */
	/**
	 * @event TextFile.error
	 * @param {TextFile} textFile
	 * @param {Error} error
	 */

	/** @type {Date} */
	updatedAt = null;

	/** @type {string} */
	filePath;

	/** @type {Date} */
	#prevCheckDate;

	/** @type {number} */
	cacheTimeout = 1000;

	/** @type {string|*} */
	encoding = "utf-8";

	/** @type {string|Buffer} */
	#content;

	/** @type {Promise<string>} */
	#getPromise;

	/** @type {boolean} */
	#isWriting = false;
	/**
	 *
	 * @param {string} filePath
	 * @param {boolean} [shouldCreateIfNotExists=false]
	 * @fires TextFile.complete
	 * @fires TextFile.error
	 */
	constructor(filePath, shouldCreateIfNotExists = false)
	{
		if(!TextFile.#allowConstruct) throw new Error("new でインスタンスを生成せず、クラスメソッドの getTextFile(filePath:string, shouldCreateIfNotExists:boolean=false) を使用してインスタンスを生成してください");
		super();

		this.filePath = filePath;

		if(!fs.existsSync(filePath) && shouldCreateIfNotExists) fs.writeFileSync(filePath, "", this.encoding);
		else throw new Error(`${filePath} 存在しないファイルが指定されました。ファイルが存在しない場合に、自動的にテキストファイルを生成させたい場合は、クラスメソッドの getTextFile の第二引数に true を指定してください`);
	}

	/**
	 *
	 * @return {Promise<string>}
	 */
	get content()
	{
		if(!this.#getPromise)
		{
			this.#getPromise = new Promise((resolve, reject)=>
			{
				fs.stat(this.filePath, (error, stats)=>
				{
					if(error) return reject(error);

					const mtime = stats.mtime;
					if(this.updatedAt < mtime)
					{
						this.updatedAt = mtime;
						fs.readFile(this.filePath, this.encoding, (error, content)=>
						{
							this.#content = content;
							resolve(this.#content);
						})
					}
					else resolve(this.#content);
				})
			});

			setTimeout(()=>
			{
				this.#getPromise = null;
			}, this.cacheTimeout);
		}

		return this.#getPromise;
	}

	/**
	 *
	 * @param {string} value
	 */
	set content(value)
	{
		this.#content = value;
		this.updatedAt = this.#prevCheckDate = new Date;
		if(!this.#isWriting)
		{
			this.#getPromise = new Promise(resolve=>resolve(value));
			this.#isWriting = true;
			const writeData = this.#content;
			fs.writeFile(this.filePath, writeData, this.encoding, ((error)=>
			{
				if(error) this.emit("error", this, error);

				this.#isWriting = false;
				if(writeData !== this.#content)
				{
					console.log("rewrite");
					this.content = this.#content;
				}
				else
				{
					this.updatedAt = fs.statSync(this.filePath).mtime;
					this.emit("complete", this);
				}
			}));
		}
	}

	get isExist()
	{
		return fs.existsSync(this.filePath);
	}

	get isWriting()
	{
		return this.#isWriting;
	}
}

module.exports = TextFile;