try {
    const OpenCC = require('opencc-js');
    console.log('OpenCC required successfully');
    const converter = OpenCC.Converter({ from: 'hk', to: 'cn' });
    console.log(converter('漢語'));
} catch (e) {
    console.error('Require failed:', e);
}
