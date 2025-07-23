/** !!! TDD !!!
 * Обработчик отправки формы заявки.
 * Здесь можно добавить логику для отправки данных на сервер.
 */
export function fetchTicket(
    Title: string,
    Description: string,
    Name: string,
    Contact: string,
    DateVal: string,
    File?: File[]
) {
    console.log('Заявка отправлена:', { Title, Description, Name, Contact, DateVal, File });
}