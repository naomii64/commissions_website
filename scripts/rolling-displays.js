class RollingNumberDigit{
    constructor(){
        this.element = document.createElement('div');
        this.element.style.height = '1em';
        //this.element.style.width = '20px';
        this.element.style.fontSize = '40px';
        //this.element.style.fontFamily = 'monospace'
        this.element.style.overflow = 'hidden';

        this.pannel1 = document.createElement('div');
        this.pannel2 = document.createElement('div');
        this.element.appendChild(this.pannel1);
        this.element.appendChild(this.pannel2);
        this.pannel1.style.width='100%';
        this.pannel1.style.height='100%';
        this.pannel2.style.width='100%';
        this.pannel2.style.height='100%';
    }
    setDecimalDigit(num) {
        const digit = ((num % 10) + 10) % 10;

        const lower = Math.floor(digit);
        const upper = (lower + 1) % 10;

        this.pannel1.textContent = upper;
        this.pannel2.textContent = lower;

        const frac = digit - lower;
        const translate = `translateY(-${(1 - frac) * 100}%)`;

        this.pannel1.style.transform = translate;
        this.pannel2.style.transform = translate;
    }
    setRawString(str){
        this.pannel1.textContent = str;
        this.pannel2.textContent = str;

        this.pannel1.style.transform = null;
        this.pannel2.style.transform = null;
    }
}
//these will use the actual number
class RollingNumberDisplay{
    constructor(){
        this.digitCount = 2;
        this.decimals = 2;
        
        this.totalDigits = this.digitCount+this.decimals;
    
        this.element = document.createElement('div');
        this.element.style.display = 'flex';

        this.animationProgress = 1.0;
        this.animating = false;

        this.digits = [];

        //make this more customizable later
        const dollarSign = new RollingNumberDigit();
        dollarSign.setRawString('$');
        this.element.appendChild(dollarSign.element);


        for(let i=0;i<this.digitCount;i++){
            const newDigit = new RollingNumberDigit();
            this.digits.push(newDigit);
            this.element.appendChild(newDigit.element);
        }
        
        const decimalPoint = new RollingNumberDigit();
        decimalPoint.setRawString('.');
        this.element.appendChild(decimalPoint.element);

        for(let i=0;i<this.decimals;i++){
            const newDigit = new RollingNumberDigit();
            this.digits.push(newDigit);
            this.element.appendChild(newDigit.element);
        }

        this.targetNumbers = [];
        this.fromNumber = 0;
        this.toNumber = 0;
    }
    scrollToNumber(num){
        const fixed = num * (10 ** this.decimals);
        //TODO: dont use an array for this later
        if(this.targetNumbers.length==0){
            this.targetNumbers.push(fixed);
        }else{
            this.targetNumbers[0] = fixed;
        }

        if(this.animating) return;
        this.animating = true;
        this.prevFrameTime = performance.now();
        this.animate();
    }
    animate(){
        if(this.animationProgress>=1.0){
            this.fromNumber = this.toNumber;
            if(this.targetNumbers.length!=0){
                this.animationProgress = 0;    
                this.toNumber = this.targetNumbers.shift()
            }else{
                this.animating = false;
                return;
            }   
        }
        const delta = (performance.now()-this.prevFrameTime)/1000;
        this.prevFrameTime = performance.now();

        this.animationProgress+=delta*2;
        this.animationProgress = Math.min(this.animationProgress,1);


        const easeInOutSine = (x) => {
            return -(Math.cos(Math.PI * x) - 1) / 2;
        }
        const lerp = (a,b,i) => ((b-a)*i)+a
        //this.element.textContent = this.animationProgress + ' | ['+this.fromNumber+'->'+this.toNumber+'] '+this.targetNumbers;
        //DISPLAY THE NUMBER
        const easedProgress = easeInOutSine(this.animationProgress);

        let f = this.fromNumber;
        let t = this.toNumber;
        for(let i=this.digits.length-1;i>=0;i--){
            //these all need to be interpolated individually to avoid snapping
            let interpolatedValue = lerp(f,t,easedProgress);

            this.digits[i].setDecimalDigit(interpolatedValue);
            f/=10;
            t/=10;
            f=Math.trunc(f);
            t=Math.trunc(t);
        }

        requestAnimationFrame(() => this.animate());
    }
}