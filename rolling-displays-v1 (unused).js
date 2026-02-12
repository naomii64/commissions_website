class RollingDisplay{
    constructor(){
        this.div = document.createElement('div');
        //test
        this.div.style.height = '1em';
        this.div.style.overflow = 'hidden';
        this.div.style.fontSize = '50px'

        this.pannel1 = document.createElement('div');
        this.div.appendChild(this.pannel1);
        this.pannel1.style.width = '100%';
        this.pannel1.style.height = '100%';

        this.pannel2 = document.createElement('div');
        this.div.appendChild(this.pannel2);
        this.pannel2.style.width = '100%';
        this.pannel2.style.height = '100%';

        this.animating = false;
        this.scrollStack = [];
        this.animProgress = 0;

        this.speedMultiplier = 1;//sign of this will also controll the roll direction
    }
    scrollTo(str){
        this.scrollStack.push(str);
        
        if(this.animating) return;
        this.prevFrameTime = performance.now();
        this.animating = true;
        this.animate();
    }
    animate(){
        if((this.pannel1.textContent==this.pannel2.textContent)&&(this.scrollStack.length <= 0)){
            this.animating = false;
            return;
        }

        const delta = (performance.now()-this.prevFrameTime)/1000;
        this.prevFrameTime = performance.now();

        this.animProgress+=delta*Math.abs(this.speedMultiplier);
        //skip indexes
        const skippable = Math.min(Math.floor(this.animProgress-1),this.scrollStack.length-1);
        this.scrollStack.splice(0,skippable);

        if(this.pannel1.textContent==this.pannel2.textContent){    
            const nextText = this.scrollStack.shift();
            this.animProgress = 0;
            this.pannel2.textContent = nextText;
        }else{
            if(this.speedMultiplier>0){
                this.pannel1.style.transform = `translateY(-${this.animProgress*100}%)`;
                this.pannel2.style.transform = `translateY(-${this.animProgress*100}%)`;
            }else{
                this.pannel1.style.transform = `translateY(${(this.animProgress)*100}%)`;
                this.pannel2.style.transform = `translateY(${(this.animProgress-2)*100}%)`;
            }
        }

        if(this.animProgress >= 1.0){
            this.pannel1.textContent = this.pannel2.textContent;
            this.pannel1.style.transform = null;
            this.pannel2.style.transform = null;
        }

        requestAnimationFrame(() => this.animate());
    }
    setRaw(str){
        this.pannel1.textContent = str;
        this.pannel2.textContent = str;
    }
}
class RollingNumberDisplay{
    constructor(){
        this.value = 0;
        //settings
        this.digits = 3;
        this.decimals = 2;


        this.prevStr = (0).toFixed(this.decimals).padStart(this.getCharCount(),'0');
        console.log(this.prevStr)
        //html
        this.element = document.createElement('div');
        this.element.style.display = 'flex';

        this.generateDigitDisplays();
    }
    addDigitDisplay(){
        const newDigit = new RollingDisplay();
        this.digitDisplays.push(newDigit);
        this.element.appendChild(newDigit.div);
        return newDigit;
    }
    generateDigitDisplays(){
        this.element.innerHTML = '';
        this.digitDisplays = [];

        for(let i=0;i<this.digits;i++){
            const digit = this.addDigitDisplay();
            digit.setRaw('0');
        };
        const decimal = this.addDigitDisplay();
        decimal.setRaw('.');
        for(let i=0;i<this.decimals;i++){
            const digit = this.addDigitDisplay();
            digit.setRaw('0');
        }
    }
    getCharCount(){
        return (this.decimals+this.digits+1);
    }
    scrollToNumber(num){

        const expectedCharacterCount = this.getCharCount();
        const str = num.toFixed(this.decimals).padStart(expectedCharacterCount,'0');

        if(str.length>expectedCharacterCount){
            throw `error: number "${str}" too big to represent in ${this.digits} upper digits`;
        }

        //the difference in values changes and this changes based on the number

        let additionalRolls = 0;
        for(let i=0;i<str.length;i++){
            if(str[i]=='.') continue;

            const from = parseInt(this.prevStr[i]);
            const target = parseInt(str[i]);
            
            
            //TODO: handle if this is negative
            const rollCount = target-from+additionalRolls;
            
            additionalRolls += rollCount;
            additionalRolls *= 10;

            this.digitDisplays[i].speedMultiplier = rollCount*((num>this.value)?3:2.5);

            const floorMod = (x,n) => ((x/n)-Math.floor(x/n))*n;

            let n = from;
            for(let roll=0;roll<=Math.abs(rollCount);roll++){
                this.digitDisplays[i].scrollTo(Math.round(floorMod(n,10)));
                
                n+=Math.sign(rollCount);
            }
        }

        this.value = num;
        this.prevStr = str;
    }
}